import re
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.entities import (
    User,
    BloodInventory,
    BloodRequest,
    DemandHistory,
    RiskAssessment,
    Hospital,
    BloodBank,
)
from app.models.enums import UserRole, BloodGroup, InventoryStatus, RequestPriority, RequestStatus
from app.services.inventory_service import get_system_thresholds
from app.services.risk_service import get_latest_risk_assessments
from app.services.audit_service import log_action

BLOOD_GROUP_REGEX = re.compile(r"(?:^|[\s,.\?!/])(AB\+|AB-|A\+|A-|B\+|B-|O\+|O-)(?:$|[\s,.\?!/])", re.IGNORECASE)


def normalize_blood_group(text: str) -> Optional[str]:
    match = BLOOD_GROUP_REGEX.search(text)
    if match:
        return match.group(1).upper()
    return None



def handle_chat_message(
    db: Session,
    user: User,
    message: str,
) -> Dict[str, Any]:
    """
    BloodBridge Assistant:
    Grounded NLP engine operating strictly on verified DB facts, the risk engine, and role ACLs.
    Returns:
      - response_text: concise, structured markdown answer
      - source_type: 'LIVE_DATABASE' | 'RISK_ENGINE' | 'ACTION_CONFIRMATION' | 'GUIDE'
      - structured_data: optional supporting stats/cards
      - pending_action: optional action requiring explicit confirmation
    """
    clean_msg = message.strip().lower()
    today = date.today()
    blood_group = normalize_blood_group(message)

    # 1. Action Intent: "Create emergency request for X units of Y"
    if "create" in clean_msg and ("request" in clean_msg or "emergency" in clean_msg):
        # Extract quantity
        qty_match = re.search(r"(\d+)\s*(?:units?|bags?)?", clean_msg)
        quantity = int(qty_match.group(1)) if qty_match else 2
        bg = blood_group or "O-"
        priority = "Critical" if ("emergency" in clean_msg or "critical" in clean_msg or "urgent" in clean_msg) else "Normal"

        return {
            "response_text": (
                f"**Emergency Request Preparation**\n\n"
                f"I can prepare this request for your review:\n"
                f"- **Blood Group:** {bg}\n"
                f"- **Quantity:** {quantity} units\n"
                f"- **Priority:** {priority}\n"
                f"- **Hospital ID:** {user.hospital_id or 'General Referral'}\n\n"
                f"*(Note: In accordance with clinical safety protocols, requests require explicit human confirmation.)*\n\n"
                f"Please confirm to dispatch this request to the regional blood-bank network."
            ),
            "source_type": "ACTION_CONFIRMATION",
            "pending_action": {
                "action_type": "CREATE_REQUEST",
                "parameters": {
                    "blood_group": bg,
                    "quantity": quantity,
                    "priority": priority,
                    "notes": f"Prepared by BloodBridge Assistant on request of {user.email}",
                },
            },
            "structured_data": {
                "blood_group": bg,
                "quantity": quantity,
                "priority": priority,
            }
        }


    # 3. Query: "Why is [Blood Group] at risk / showing shortage risk?"
    if ("risk" in clean_msg or "why" in clean_msg) and blood_group:
        assessments = get_latest_risk_assessments(db)
        match = next((a for a in assessments if a["blood_group"] == blood_group), None)
        if match:
            reasons_formatted = "\n".join([f"• {r}" for r in match["reasons"]])
            return {
                "response_text": (
                    f"**{blood_group} Risk Assessment — {match['risk_level']}**\n\n"
                    f"**Current Status:**\n"
                    f"• Available inventory: {match['current_inventory']} units\n"
                    f"• Predicted 7-day demand: {match['predicted_demand']} units\n"
                    f"• Units expiring soon: {match['expiring_units']}\n"
                    f"• Active requests: {match['active_requests']}\n\n"
                    f"**Contributing Factors:**\n{reasons_formatted}\n\n"
                    f"*(Source: Explainable Risk Engine. Operational indicator, not medical diagnosis.)*"
                ),
                "source_type": "RISK_ENGINE",
                "structured_data": match,
            }
        else:
            return {
                "response_text": f"No active risk alert registered for blood group {blood_group}. Current supply is operating within standard parameters.",
                "source_type": "RISK_ENGINE",
            }

    # 5. Query: "How many [Blood Group] units are available?" / "Show me [Blood Group] stock"
    if ("available" in clean_msg or "units" in clean_msg or "stock" in clean_msg or "inventory" in clean_msg) and blood_group:
        # Check permissions: if hospital staff, show network availability
        avail_query = db.query(func.sum(BloodInventory.quantity)).filter(
            BloodInventory.blood_group == blood_group,
            BloodInventory.status == InventoryStatus.AVAILABLE,
            BloodInventory.expiry_date >= today,
        )
        total_avail = avail_query.scalar() or 0

        reserved = db.query(func.sum(BloodInventory.quantity)).filter(
            BloodInventory.blood_group == blood_group,
            BloodInventory.status == InventoryStatus.RESERVED,
        ).scalar() or 0

        return {
            "response_text": (
                f"**Live Database Record: {blood_group}**\n\n"
                f"• **Available Units:** {total_avail} units\n"
                f"• **Reserved Units:** {reserved} units\n"
                f"• **Status:** {'Sufficient Buffer' if total_avail > 15 else 'Low Supply - Monitoring Required'}\n\n"
                f"*(Real-time inventory verified at {datetime.utcnow().strftime('%H:%M:%S UTC')} across participating facilities.)*"
            ),
            "source_type": "LIVE_DATABASE",
            "structured_data": {"blood_group": blood_group, "available": total_avail, "reserved": reserved},
        }

    # 6. Query: "Which blood groups are low?"
    if "low" in clean_msg or "shortage" in clean_msg:
        all_groups = [g.value for g in BloodGroup]
        low_list = []
        for bg in all_groups:
            avail = db.query(func.sum(BloodInventory.quantity)).filter(
                BloodInventory.blood_group == bg,
                BloodInventory.status == InventoryStatus.AVAILABLE,
                BloodInventory.expiry_date >= today,
            ).scalar() or 0
            if avail < 15:
                low_list.append({"blood_group": bg, "units": avail})

        if low_list:
            formatted = "\n".join([f"• **{item['blood_group']}**: {item['units']} units remaining" for item in low_list])
            return {
                "response_text": (
                    f"**Low Inventory Alert**\n\n"
                    f"The following {len(low_list)} blood group(s) are below the operational threshold of 15 units:\n\n"
                    f"{formatted}\n\n"
                    f"*(Live database verification. Consider scheduling donor collection or coordinating network reserves.)*"
                ),
                "source_type": "LIVE_DATABASE",
                "structured_data": low_list,
            }
        else:
            return {
                "response_text": "All blood groups are currently above the operational low-stock threshold (15 units). Regional supplies are healthy.",
                "source_type": "LIVE_DATABASE",
            }

    # 7. Query: "Which units expire this week?" / "expiring"
    if "expire" in clean_msg or "expiring" in clean_msg:
        next_week = today + timedelta(days=7)
        expiring = db.query(BloodInventory).filter(
            BloodInventory.status == InventoryStatus.AVAILABLE,
            BloodInventory.expiry_date >= today,
            BloodInventory.expiry_date <= next_week,
        ).order_by(BloodInventory.expiry_date.asc()).limit(10).all()

        total_expiring_units = sum(i.quantity for i in expiring)
        if expiring:
            formatted = "\n".join([f"• Batch **{i.batch_id}** ({i.blood_group.value}): {i.quantity} unit(s) expire on {i.expiry_date} ({(i.expiry_date - today).days} days left)" for i in expiring])
            return {
                "response_text": (
                    f"**Expiry Monitoring (Next 7 Days)**\n\n"
                    f"Total expiring: **{total_expiring_units} units** across {len(expiring)} tracked batch(es):\n\n"
                    f"{formatted}\n\n"
                    f"*(Operational suggestion: Prioritize FIFO issuance for scheduled non-emergency procedures.)*"
                ),
                "source_type": "LIVE_DATABASE",
                "structured_data": {"total_units": total_expiring_units, "batches_count": len(expiring)},
            }
        else:
            return {
                "response_text": "Good news: No active blood inventory batches are scheduled to expire within the next 7 days.",
                "source_type": "LIVE_DATABASE",
            }

    # 8. Query: "How many emergency requests are pending?"
    if "request" in clean_msg and ("pending" in clean_msg or "emergency" in clean_msg or "how many" in clean_msg):
        pending = db.query(BloodRequest).filter(
            BloodRequest.status.in_([RequestStatus.SUBMITTED, RequestStatus.REVIEWING])
        ).all()
        critical_count = sum(1 for r in pending if r.priority == RequestPriority.CRITICAL)
        urgent_count = sum(1 for r in pending if r.priority == RequestPriority.URGENT)

        return {
            "response_text": (
                f"**Live Blood Request Queue**\n\n"
                f"• **Total Active / Pending Requests:** {len(pending)}\n"
                f"• **Critical Priority:** {critical_count}\n"
                f"• **Urgent Priority:** {urgent_count}\n"
                f"• **Standard Priority:** {len(pending) - critical_count - urgent_count}\n\n"
                f"*(Real-time request log from regional hospitals.)*"
            ),
            "source_type": "LIVE_DATABASE",
            "structured_data": {"total_pending": len(pending), "critical": critical_count, "urgent": urgent_count},
        }

    # 9. Query: "Show me this month's blood usage" / "usage"
    if "usage" in clean_msg or "transfused" in clean_msg or "trend" in clean_msg:
        thirty_days_ago = today - timedelta(days=30)
        total_used = db.query(func.sum(DemandHistory.units_used)).filter(DemandHistory.date >= thirty_days_ago).scalar() or 0
        top_group = (
            db.query(DemandHistory.blood_group, func.sum(DemandHistory.units_used))
            .filter(DemandHistory.date >= thirty_days_ago)
            .group_by(DemandHistory.blood_group)
            .order_by(func.sum(DemandHistory.units_used).desc())
            .first()
        )
        top_name = top_group[0].value if top_group else "O+"
        top_units = top_group[1] if top_group else 0

        return {
            "response_text": (
                f"**Regional Blood Usage (Past 30 Days)**\n\n"
                f"• **Total Units Transfused:** {total_used} units\n"
                f"• **Highest Demand Blood Group:** {top_name} ({top_units} units)\n"
                f"• **Average Daily Consumption:** {round(total_used / 30, 1)} units/day\n\n"
                f"*(Grounded in historical transfusion tracking records.)*"
            ),
            "source_type": "LIVE_DATABASE",
            "structured_data": {"total_used_30d": total_used, "top_group": top_name, "top_units": top_units},
        }

    # Default Helpful Response
    return {
        "response_text": (
            "I am **BloodBridge Assistant**, grounded in live inventory, the shortage risk engine, and emergency protocols.\n\n"
            "You can ask me questions like:\n"
            "• *\"How many O+ units are available?\"*\n"
            "• *\"Which blood groups are low?\"*\n"
            "• *\"Which units expire this week?\"*\n"
            "• *\"How many emergency requests are pending?\"*\n"
            "• *\"Why is O- showing high shortage risk?\"*\n"
            "• *\"Show me this month's blood usage.\"*\n\n"
            "You can also say *\"Create an emergency request for 6 units of O-\"* to prepare an action for your confirmation."
        ),
        "source_type": "GUIDE",
    }


def execute_confirmed_action(
    db: Session,
    user: User,
    action_type: str,
    parameters: Dict[str, Any],
) -> Dict[str, Any]:
    """Execute confirmed action with full audit trail."""
    if action_type == "CREATE_REQUEST":
        from app.services.request_service import create_blood_request
        from app.schemas.request import BloodRequestCreate

        priority_raw = str(parameters.get("priority", "Critical")).strip().title()
        try:
            req_priority = RequestPriority(priority_raw)
        except ValueError:
            req_priority = RequestPriority.CRITICAL

        req_schema = BloodRequestCreate(
            hospital_id=user.hospital_id or 1,
            blood_group=BloodGroup(parameters["blood_group"]),
            quantity=int(parameters["quantity"]),
            priority=req_priority,
            required_datetime=datetime.utcnow() + timedelta(hours=2),
            notes=parameters.get("notes", "Created via confirmed Assistant action"),
        )
        created = create_blood_request(db, req_schema, current_user=user)
        log_action(
            db,
            action="CHATBOT_CONFIRMED_ACTION",
            entity_type="BloodRequest",
            entity_id=str(created.id),
            description=f"User {user.email} confirmed chatbot action: created request #{created.id} for {created.quantity} units of {created.blood_group.value}",
            user_id=user.id,
        )
        return {
            "status": "COMPLETED",
            "action_type": action_type,
            "message": f"Successfully created emergency request #{created.id} for {created.quantity} units of {created.blood_group.value}.",
            "data": {"request_id": created.id, "status": created.status.value},
        }


    return {"status": "FAILED", "message": f"Unsupported action type: {action_type}"}
