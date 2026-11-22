# Shipping carriers — plan

Owner, 2026-11-22. The merchant contracts a carrier himself (Bosta first) and connects his own account here; the cash
on delivery goes from the carrier to the merchant (the platform never holds money). Other carriers follow the same
way, one file each. Built so two later kinds fit without changes:

1. **Merchant's own account** (now): Bosta, then others.
2. **Partner carriers** (maybe, not now): small carriers contracted by Mksab, the merchant switches them on and fills a
   few details. = a carrier account whose credentials come from the platform (`mode: platform`), not the merchant.
3. **«شحن مكسب»** (future): Mksab's own couriers. = one more carrier class (no outside API: our own states).

Decisions (owner): all plans; auto-ship on confirm is an option; several companies: the merchant picks either
«the customer chooses at checkout» (today's behaviour) or «a default company per governorate» (checkout shows none).

## Bosta API (from its OpenAPI spec, docs.bosta.co/api/api.yaml, 2026-11-22)
- Base `https://app.bosta.co/api/v2`, header `Authorization: <api key>` (keys: Settings → API Integration).
- `POST /deliveries?apiVersion=1` {type 10, cod, specs{packageType, size, packageDetails{itemsCount, description}},
  dropOffAddress{city, districtId | zoneId, firstLine (>5 chars), secondLine, buildingNumber, floor, apartment},
  receiver{firstName, lastName, phone, secondPhone, email}, businessReference, notes, allowToOpenPackage (+ 1–10
  product photo URLs in deliveryImages), businessLocationId, webhookUrl, webhookCustomHeaders{Authorization}}
  → data{_id, trackingNumber, state{code, value}}. COD ≤ 30,000.
- `GET /deliveries/business/{tracking}` (state, timeline), `DELETE /deliveries/business/{tracking}/terminate`.
- `POST /deliveries/mass-awb` {trackingNumbers "a,b", requestedAwbType A4|A6, lang ar} → base64 PDF (≤ 50; more is
  emailed by Bosta).
- `GET /pickup-locations` (also checks the key), `POST /pickups` {scheduledDate, businessLocationId, numberOfParcels,
  contactPerson}.
- Public: `GET /cities` (name, nameAr, code EG-01…: the governorates), `GET /cities/{id}/districts` (zone/district
  ids with Arabic `…OtherName`).
- Webhook on every state change (POST): _id, trackingNumber, state (number), cod, exceptionReason, exceptionCode,
  businessReference, numberOfAttempts. No signature: we send our own secret in `webhookCustomHeaders`.
- States: 10 pickup requested, 20/21 route assigned / picked up, 24 at warehouse, 30 in transit, 41 out for delivery,
  45 delivered, 46 returned to business, 47 exception, 48 terminated, 49 cancelled, 100 lost, 101 damaged,
  102 investigation, 103 awaiting your action, 105 on hold.

## Design
- `carrier_accounts` (tenant, carrier key, mode own|platform, encrypted credentials, webhook token + secret, settings:
  pickup location, open package, package type / size, label size, auto-ship; status, last error) linked to the store's
  `shipping_companies` row (its fees per governorate stay where they are).
- `shipments` (one active per order: carrier, external id, tracking number, our state, carrier code / label, COD,
  exception reason, attempts) + `shipment_events` (the timeline).
- `App\Shipping\Carriers\Carrier` contract + `Carriers` registry; `BostaCarrier` (HTTP) and `FakeCarrier` (tests, e2e,
  `SHIPPING_CARRIERS_DRIVER=fake`). Address: our governorate → Bosta city by Arabic name; the order's city text → a
  Bosta district when it matches clearly, else the merchant picks it in the ship dialog.
- Our states → order: picked up / in transit / out for delivery → «تم الشحن»; delivered → «تم التسليم»; returned to
  business → «مسترجع» (stock back); lost / damaged → «هالك»; exception / awaiting action → the merchant's bell.
  Order changes go through `ChangeOrderStatus` (customer messages, webhooks, stock as today).
- Webhook: Bosta → Next `/api/webhooks/shipping/{carrier}/{token}` → Laravel (internal key), secret checked, then
  applied inside the tenant. A scheduled sync refreshes open shipments when a webhook is missed.
- Copilot: a `shipments` resource and actions to ship orders, cancel a shipment and request a pickup.

## PROGRESS LOG
- 2026-11-22: **Bosta built end to end.** Back: `carrier_accounts`, `shipments`, `shipment_events`, `shipping_settings.company_choice / governorate_companies`, `shipping_companies.carrier_account_id`; `App\Shipping` (Carrier contract, Carriers registry, BostaCarrier, FakeCarrier, PlaceNames, ConnectCarrier, ShipOrder, ApplyShipmentUpdate, ManageShipments), `AutoShipOrder` job (on confirm), `shipments:sync`, webhook controller + Next relay, tracking page timeline, governorate mode in `Pricing\Shipping`. Copilot: `shipments` resource, `shipping.ship_orders`, `shipping.cancel_shipments`, `shipping.request_pickup`. Front: «ربط شركات الشحن» (connect with steps, settings drawer with pickup locations, courier request, check / change key / disconnect), «مين بيختار شركة الشحن؟», order page shipment card (ship dialog with matched area or a pick list, airway bill, refresh, cancel, timeline), orders list «اشحن المحدد» (10 at a time with progress and reasons) and «اطبع البوالص», shipment state in the list, bell icon, store tracking timeline. Tests: back Shipping (+22), front carriers.test (+6). Not tried against a live Bosta account yet (needs the owner's key; the spec's response shapes are covered with Http::fake).
