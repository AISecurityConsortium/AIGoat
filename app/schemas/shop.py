from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ReviewOut(BaseModel):
    id: int
    product: int
    rating: int
    comment: str
    user_name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductOut(BaseModel):
    id: int
    name: str
    description: str
    detailed_description: str | None = None
    specifications: dict = {}
    price: float
    image: str | None = None
    image_url: str | None = None
    average_rating: float
    review_count: int
    reviews: list[ReviewOut]
    quantity: int
    is_sold_out: bool
    is_available: bool
    stock_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CartItemOut(BaseModel):
    id: int
    product: int
    product_name: str
    quantity: int
    product_price: float
    product_image_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CartOut(BaseModel):
    id: int
    items: list[CartItemOut]
    total: float

    model_config = ConfigDict(from_attributes=True)


class OrderItemOut(BaseModel):
    id: int
    product: int
    product_name: str
    quantity: int
    price: float
    product_image_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PaymentOut(BaseModel):
    id: int
    user_name: str
    card_number: str | None
    card_type: str | None
    amount: float | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ShippingInfo(BaseModel):
    name: str
    email: str
    phone: str
    address: str
    city: str
    state: str
    zip_code: str
    country: str

    model_config = ConfigDict(from_attributes=True)


class OrderOut(BaseModel):
    id: int
    order_id: str
    user_name: str
    created_at: datetime
    total_amount: float
    final_amount: float | None = None
    discount_amount: float
    applied_coupon: str | None = None
    status: str
    items: list[OrderItemOut]
    payment: PaymentOut | None = None
    shipping_info: ShippingInfo

    model_config = ConfigDict(from_attributes=True)


class AddToCartRequest(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1)

    model_config = ConfigDict(from_attributes=True)


class UpdateCartItemRequest(BaseModel):
    quantity: int = Field(ge=1)

    model_config = ConfigDict(from_attributes=True)


class CheckoutRequest(BaseModel):
    shipping_info: dict[str, Any]
    payment_info: dict[str, Any]
    order_id: str | None = None
    coupon_code: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ReviewCreateRequest(BaseModel):
    product: int
    rating: int
    comment: str

    model_config = ConfigDict(from_attributes=True)


class ApplyCouponRequest(BaseModel):
    coupon_code: str

    model_config = ConfigDict(from_attributes=True)


class CouponOut(BaseModel):
    id: int
    code: str
    name: str
    description: str
    discount_type: str
    discount_value: float
    minimum_order_amount: float
    maximum_discount: float | None = None
    usage_limit: int
    usage_limit_per_user: int
    target_audience: str
    valid_from: datetime
    valid_until: datetime
    is_active: bool
    status: str
    total_usage_count: int
    remaining_usage: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
