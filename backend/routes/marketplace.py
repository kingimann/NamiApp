"""Marketplace listings + contact seller."""
import re
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Header, HTTPException, Query

from core import _conv_key, _public_user, db, get_current_user
from models import (
    ConversationView,
    Listing,
    ListingCreate,
    ListingPatch,
    MarketplaceReview,
    MarketplaceReviewCreate,
    Message,
    PostAuthor,
    SellerProfile,
)
from services.encryption import encrypt_text, decrypt_text

router = APIRouter()


async def _hydrate_listing(
    doc: dict, viewer_id: Optional[str] = None,
    saved_ids: Optional[set] = None, with_counts: bool = False,
) -> Listing:
    author_doc = await db.users.find_one({"user_id": doc["user_id"]}, {"_id": 0})
    seller = PostAuthor(
        user_id=doc["user_id"],
        name=author_doc.get("name", "Unknown") if author_doc else "Unknown",
        picture=author_doc.get("picture") if author_doc else None,
    )
    photos = doc.get("photos") or ([doc["photo_base64"]] if doc.get("photo_base64") else [])
    if saved_ids is not None:
        saved_by_me = doc["id"] in saved_ids
    elif viewer_id:
        saved_by_me = bool(await db.listing_saves.find_one(
            {"listing_id": doc["id"], "user_id": viewer_id}, {"_id": 0, "id": 1}))
    else:
        saved_by_me = False
    saved_count = await db.listing_saves.count_documents({"listing_id": doc["id"]}) if with_counts else 0
    return Listing(
        id=doc["id"], user_id=doc["user_id"], seller=seller,
        title=doc["title"], price=doc.get("price", 0),
        currency=doc.get("currency", "USD"),
        category=doc.get("category", "other"),
        condition=doc.get("condition", "used"),
        description=doc.get("description", ""),
        photo_base64=doc.get("photo_base64"),
        photos=photos,
        longitude=doc.get("longitude"), latitude=doc.get("latitude"),
        locality=doc.get("locality"),
        status=doc.get("status", "active"),
        views_count=doc.get("views_count", 0),
        saved_count=saved_count,
        saved_by_me=saved_by_me,
        created_at=doc["created_at"],
    )


async def _saved_ids_for(user_id: str) -> set:
    rows = await db.listing_saves.find({"user_id": user_id}, {"_id": 0, "listing_id": 1}).to_list(1000)
    return {r["listing_id"] for r in rows if r.get("listing_id")}


_MEDIA_LIMIT = 8 * 1024 * 1024


def _clean_photos(body) -> list:
    photos = list(body.photos or [])
    if not photos and getattr(body, "photo_base64", None):
        photos = [body.photo_base64]
    return [p for p in photos[:6] if p and len(p) <= _MEDIA_LIMIT]


@router.post("/listings", response_model=Listing)
async def create_listing(body: ListingCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    title = (body.title or "").strip()[:120]
    if not title:
        raise HTTPException(status_code=400, detail="Title required")
    if body.price < 0:
        raise HTTPException(status_code=400, detail="Price must be ≥ 0")
    photos = _clean_photos(body)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "title": title,
        "price": float(body.price),
        "currency": (body.currency or "USD")[:8],
        "category": body.category or "other",
        "condition": body.condition or "used",
        "description": (body.description or "")[:2000],
        "photo_base64": photos[0] if photos else None,
        "photos": photos,
        "longitude": body.longitude,
        "latitude": body.latitude,
        "locality": (body.locality or "")[:120],
        "status": "active",
        "views_count": 0,
        "created_at": datetime.now(timezone.utc),
    }
    await db.listings.insert_one(doc.copy())
    return await _hydrate_listing(doc, viewer_id=user["user_id"])


@router.get("/listings", response_model=List[Listing])
async def list_listings(
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    status: Optional[str] = Query("active"),
    condition: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    sort: Optional[str] = Query("recent"),  # recent | price_low | price_high
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(authorization)
    filt: dict = {}
    if status and status != "all":
        filt["status"] = status
    if category and category != "all":
        filt["category"] = category
    if condition and condition != "all":
        filt["condition"] = condition
    price_filt: dict = {}
    if min_price is not None:
        price_filt["$gte"] = float(min_price)
    if max_price is not None:
        price_filt["$lte"] = float(max_price)
    if price_filt:
        filt["price"] = price_filt
    if q and q.strip():
        pattern = re.escape(q.strip())
        filt["$or"] = [
            {"title": {"$regex": pattern, "$options": "i"}},
            {"description": {"$regex": pattern, "$options": "i"}},
        ]
    sort_field, sort_dir = "created_at", -1
    if sort == "price_low":
        sort_field, sort_dir = "price", 1
    elif sort == "price_high":
        sort_field, sort_dir = "price", -1
    cursor = db.listings.find(filt, {"_id": 0}).sort(sort_field, sort_dir).limit(100)
    docs = await cursor.to_list(100)
    saved_ids = await _saved_ids_for(user["user_id"])
    return [await _hydrate_listing(d, saved_ids=saved_ids) for d in docs]


@router.get("/listings/saved", response_model=List[Listing])
async def saved_listings(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    saved = await db.listing_saves.find(
        {"user_id": user["user_id"]}, {"_id": 0, "listing_id": 1}
    ).sort("created_at", -1).to_list(200)
    ids = [s["listing_id"] for s in saved]
    if not ids:
        return []
    docs = await db.listings.find({"id": {"$in": ids}}, {"_id": 0}).to_list(200)
    order = {lid: i for i, lid in enumerate(ids)}
    docs.sort(key=lambda d: order.get(d["id"], 1e9))
    return [await _hydrate_listing(d, viewer_id=user["user_id"]) for d in docs]


@router.get("/listings/user/{user_id}", response_model=List[Listing])
async def listings_by_user(user_id: str, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    cursor = db.listings.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(100)
    saved_ids = await _saved_ids_for(me["user_id"])
    return [await _hydrate_listing(d, saved_ids=saved_ids) for d in docs]


@router.get("/listings/{listing_id}", response_model=Listing)
async def get_listing(listing_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    doc = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Listing not found")
    # Count a view (not for the owner).
    if doc["user_id"] != user["user_id"]:
        await db.listings.update_one({"id": listing_id}, {"$inc": {"views_count": 1}})
        doc["views_count"] = doc.get("views_count", 0) + 1
    return await _hydrate_listing(doc, viewer_id=user["user_id"], with_counts=True)


@router.post("/listings/{listing_id}/save")
async def save_listing(listing_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    listing = await db.listings.find_one({"id": listing_id}, {"_id": 0, "id": 1})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    existing = await db.listing_saves.find_one(
        {"listing_id": listing_id, "user_id": user["user_id"]}, {"_id": 0, "id": 1})
    if not existing:
        await db.listing_saves.insert_one({
            "id": str(uuid.uuid4()),
            "listing_id": listing_id,
            "user_id": user["user_id"],
            "created_at": datetime.now(timezone.utc),
        })
    return {"ok": True, "saved": True}


@router.delete("/listings/{listing_id}/save")
async def unsave_listing(listing_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await db.listing_saves.delete_one({"listing_id": listing_id, "user_id": user["user_id"]})
    return {"ok": True, "saved": False}


@router.patch("/listings/{listing_id}", response_model=Listing)
async def patch_listing(
    listing_id: str, body: ListingPatch, authorization: Optional[str] = Header(None)
):
    user = await get_current_user(authorization)
    doc = await db.listings.find_one({"id": listing_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Listing not found")
    patch = {}
    if body.title is not None and body.title.strip():
        patch["title"] = body.title.strip()[:120]
    if body.price is not None:
        if body.price < 0:
            raise HTTPException(status_code=400, detail="Price must be ≥ 0")
        patch["price"] = float(body.price)
    if body.currency is not None:
        patch["currency"] = body.currency[:8]
    if body.category is not None:
        patch["category"] = body.category
    if body.condition is not None:
        patch["condition"] = body.condition
    if body.description is not None:
        patch["description"] = body.description[:2000]
    if body.photos is not None:
        photos = [p for p in body.photos[:6] if p and len(p) <= _MEDIA_LIMIT]
        patch["photos"] = photos
        patch["photo_base64"] = photos[0] if photos else None
    elif body.photo_base64 is not None:
        patch["photo_base64"] = body.photo_base64
        patch["photos"] = [body.photo_base64] if body.photo_base64 else []
    if body.status is not None:
        patch["status"] = body.status
    if patch:
        await db.listings.update_one({"id": listing_id}, {"$set": patch})
    updated = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    return await _hydrate_listing(updated, viewer_id=user["user_id"], with_counts=True)


@router.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    res = await db.listings.delete_one({"id": listing_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Listing not found")
    return {"ok": True}


# ---------- Seller / buyer profiles + reviews ----------
async def _hydrate_review(doc: dict) -> MarketplaceReview:
    author_doc = await db.users.find_one({"user_id": doc["reviewer_id"]}, {"_id": 0})
    reviewer = PostAuthor(
        user_id=doc["reviewer_id"],
        name=author_doc.get("name", "Unknown") if author_doc else "Unknown",
        picture=author_doc.get("picture") if author_doc else None,
    )
    return MarketplaceReview(
        id=doc["id"], subject_user_id=doc["subject_user_id"], reviewer=reviewer,
        rating=doc.get("rating", 5), text=doc.get("text", ""), created_at=doc["created_at"],
    )


@router.get("/marketplace/users/{user_id}", response_model=SellerProfile)
async def seller_profile(user_id: str, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    udoc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1})
    if not udoc:
        raise HTTPException(status_code=404, detail="User not found")
    pu = await _public_user(user_id)
    ratings = await db.marketplace_reviews.find(
        {"subject_user_id": user_id}, {"_id": 0, "rating": 1}
    ).to_list(2000)
    count = len(ratings)
    rating = round(sum(r.get("rating", 0) for r in ratings) / count, 1) if count else 0.0
    listing_docs = await db.listings.find(
        {"user_id": user_id, "status": {"$ne": "sold"}}, {"_id": 0}
    ).sort("created_at", -1).to_list(60)
    saved_ids = await _saved_ids_for(me["user_id"])
    listings = [await _hydrate_listing(d, saved_ids=saved_ids) for d in listing_docs]
    listing_count = await db.listings.count_documents({"user_id": user_id})
    reviewed_by_me = bool(await db.marketplace_reviews.find_one(
        {"subject_user_id": user_id, "reviewer_id": me["user_id"]}, {"_id": 0, "id": 1}
    ))
    return SellerProfile(
        user=pu, rating=rating, review_count=count,
        listing_count=listing_count, listings=listings, reviewed_by_me=reviewed_by_me,
    )


@router.get("/marketplace/users/{user_id}/reviews", response_model=List[MarketplaceReview])
async def list_seller_reviews(user_id: str, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    docs = await db.marketplace_reviews.find(
        {"subject_user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [await _hydrate_review(d) for d in docs]


@router.post("/marketplace/users/{user_id}/reviews", response_model=MarketplaceReview)
async def add_seller_review(
    user_id: str, body: MarketplaceReviewCreate, authorization: Optional[str] = Header(None)
):
    me = await get_current_user(authorization)
    if user_id == me["user_id"]:
        raise HTTPException(status_code=400, detail="You can't review yourself")
    subj = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1})
    if not subj:
        raise HTTPException(status_code=404, detail="User not found")
    rating = max(1, min(5, int(body.rating or 5)))
    text = (body.text or "")[:1000]
    now = datetime.now(timezone.utc)
    existing = await db.marketplace_reviews.find_one(
        {"subject_user_id": user_id, "reviewer_id": me["user_id"]}, {"_id": 0}
    )
    if existing:
        await db.marketplace_reviews.update_one(
            {"id": existing["id"]},
            {"$set": {"rating": rating, "text": text, "created_at": now}},
        )
        rid = existing["id"]
    else:
        rid = str(uuid.uuid4())
        await db.marketplace_reviews.insert_one({
            "id": rid, "subject_user_id": user_id, "reviewer_id": me["user_id"],
            "rating": rating, "text": text, "created_at": now,
        })
    doc = await db.marketplace_reviews.find_one({"id": rid}, {"_id": 0})
    return await _hydrate_review(doc)


@router.post("/listings/{listing_id}/contact", response_model=ConversationView)
async def contact_seller(listing_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    listing = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot message yourself about your own listing")
    seller_id = listing["user_id"]
    key = _conv_key(user["user_id"], seller_id)
    existing = await db.conversations.find_one({"key": key}, {"_id": 0})
    if existing:
        conv = existing
    else:
        conv = {
            "id": str(uuid.uuid4()),
            "key": key,
            "participant_ids": sorted([user["user_id"], seller_id]),
            "last_message_at": None,
            "created_at": datetime.now(timezone.utc),
        }
        await db.conversations.insert_one(conv.copy())
        conv.pop("_id", None)
    now = datetime.now(timezone.utc)
    await db.messages.insert_one({
        "id": str(uuid.uuid4()),
        "conversation_id": conv["id"],
        "sender_id": user["user_id"],
        "type": "text",
        "text": encrypt_text(f"Hi! Is your listing \"{listing['title']}\" still available?"),
        "place_name": None,
        "place_address": None,
        "place_longitude": None,
        "place_latitude": None,
        "created_at": now,
    })
    await db.conversations.update_one({"id": conv["id"]}, {"$set": {"last_message_at": now}})
    other = await _public_user(seller_id)
    last_msg_doc = await db.messages.find_one(
        {"conversation_id": conv["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    if last_msg_doc:
        last_msg_doc = {**last_msg_doc, "text": decrypt_text(last_msg_doc.get("text") or "")}
    return ConversationView(
        id=conv["id"],
        other_user=other,
        last_message=Message(**last_msg_doc) if last_msg_doc else None,
        last_message_at=now,
        unread_count=0,
        created_at=conv["created_at"],
    )
