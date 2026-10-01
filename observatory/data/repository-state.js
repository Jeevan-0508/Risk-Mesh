// Generated from committed repository files.
export default {
  "schema_version": "mesh-repository-state.v1",
  "captured_at": "2026-09-30T16:23:05.413Z",
  "sources": [
    {
      "source_id": "freight-fraud-taxonomy:docs/data.json",
      "repository": "Jeevan-0508/freight-fraud-taxonomy",
      "path": "docs/data.json",
      "revision": "ea2b0d38e11f3f075b4ad9ed3002d06ced78f014",
      "sha256": "939dbf6a55a654f5a69cf5472490f79ef5b17e6e80f5cf6b0cf2d57072b0dbc8",
      "url": "https://github.com/Jeevan-0508/freight-fraud-taxonomy/blob/ea2b0d38e11f3f075b4ad9ed3002d06ced78f014/docs/data.json",
      "data_class": "authored_repository_catalogue",
      "authenticity": "git_bytes_not_independent_factual_verification"
    },
    {
      "source_id": "ai-governance-control-room:docs/frameworks.json",
      "repository": "Jeevan-0508/ai-governance-control-room",
      "path": "docs/frameworks.json",
      "revision": "b7ee8f109f823d53726a49f94b36ad6358ec5251",
      "sha256": "2a690b4d9eed2b7a380c80ac4fd2b5b457ec0f1c4edbba50c5e0b10ceacd1108",
      "url": "https://github.com/Jeevan-0508/ai-governance-control-room/blob/b7ee8f109f823d53726a49f94b36ad6358ec5251/docs/frameworks.json",
      "data_class": "authored_repository_catalogue",
      "authenticity": "git_bytes_not_independent_factual_verification"
    },
    {
      "source_id": "ai-governance-control-room:docs/controls.json",
      "repository": "Jeevan-0508/ai-governance-control-room",
      "path": "docs/controls.json",
      "revision": "b7ee8f109f823d53726a49f94b36ad6358ec5251",
      "sha256": "209d3a415923e71f3e2603615bd942d269bbcab251c1eb1fc1c65be45392dfbf",
      "url": "https://github.com/Jeevan-0508/ai-governance-control-room/blob/b7ee8f109f823d53726a49f94b36ad6358ec5251/docs/controls.json",
      "data_class": "authored_repository_catalogue",
      "authenticity": "git_bytes_not_independent_factual_verification"
    },
    {
      "source_id": "dora-compliance-scanner:docs/requirements.json",
      "repository": "Jeevan-0508/dora-compliance-scanner",
      "path": "docs/requirements.json",
      "revision": "9c268d19fad0e57a02861897e9425c36745b94d9",
      "sha256": "0c9d9230f3edabbcad0709a192779861d72a8ab676efbe4d476996fb8527fb71",
      "url": "https://github.com/Jeevan-0508/dora-compliance-scanner/blob/9c268d19fad0e57a02861897e9425c36745b94d9/docs/requirements.json",
      "data_class": "authored_repository_catalogue",
      "authenticity": "git_bytes_not_independent_factual_verification"
    }
  ],
  "taxonomy": {
    "version": "1.1.0",
    "source_id": "freight-fraud-taxonomy:docs/data.json",
    "patterns": [
      {
        "id": "FFT-001",
        "name": "Double Brokering",
        "summary": "A carrier that has been awarded a load does not move it, but silently re-tenders it to an unvetted third party while continuing to present itself as the performing carrier. The shipper loses visibility of who is physically holding the cargo, and the liability chain no longer matches the contractual chain.",
        "severity": "high",
        "category": "contractual",
        "indicators": [
          {
            "phase": "pre_award",
            "signal": "Carrier accepts a rate materially below the prevailing corridor market rate without a plausible backhaul explanation",
            "observable_in": "Tender or bid record compared with lane rate benchmark",
            "weight": 3,
            "notes": "On its own this is only commercial behaviour. It gains weight in combination with a thin asset profile."
          },
          {
            "phase": "pre_award",
            "signal": "Registered fleet size or reported power units cannot plausibly cover the volume the entity is bidding on",
            "observable_in": "National operator licence register versus tender volume",
            "weight": 4
          },
          {
            "phase": "pre_award",
            "signal": "Contact telephone or email domain differs from the domain registered to the licensed operator",
            "observable_in": "Onboarding contact record versus operator licence record",
            "weight": 3
          },
          {
            "phase": "in_transit",
            "signal": "Tractor unit, trailer plate or driver name at pickup does not match the dispatch confirmation",
            "observable_in": "Gate check, driver ID check, photograph at loading",
            "weight": 5,
            "notes": "This is the single strongest and cheapest detection point. It requires only that someone compares two fields at the gate."
          },
          {
            "phase": "in_transit",
            "signal": "Telematics or ELD feed is unavailable, and position updates arrive only as manual driver check calls",
            "observable_in": "Visibility platform",
            "weight": 3
          },
          {
            "phase": "post_event",
            "signal": "An unknown third carrier contacts the shipper directly chasing payment for the same load",
            "observable_in": "Accounts payable enquiries",
            "weight": 5,
            "notes": "Near-conclusive. An unpaid subcontractor surfacing is often the first time the shipper learns the load was re-brokered."
          },
          {
            "phase": "post_event",
            "signal": "Claim is submitted by, or on behalf of, an entity that does not appear anywhere in the contractual chain",
            "observable_in": "Claims file",
            "weight": 4
          },
          {
            "phase": "in_transit",
            "signal": "At a multi-leg or intermodal handoff, the booking reference in the system of record becomes decoupled from the physical asset that actually checks in, and the two are never reconciled",
            "observable_in": "Booking/reference system reconciled against the physical asset ID confirmed at the rail, port or terminal check-in",
            "weight": 4,
            "notes": "This is where re-tendering or loss most often escapes detection: not at the original award, but at a leg where custody transfers between systems that do not talk to each other. A mismatch here can persist for weeks if never reconciled."
          }
        ],
        "countermeasures": {
          "preventive": [
            "Require written disclosure and prior approval of any subcontracting, and make undisclosed re-tendering an express termination event in the transport contract.",
            "Verify operating authority and insurance against the issuing register directly, not against a document supplied by the counterparty.",
            "Cross-check that the entity's declared fleet capacity is consistent with the volume it is being awarded.",
            "Confirm bank details out of band before the first payment, and treat any later change of bank details as a new verification event.",
            "Reconcile the booking reference against the physical asset that actually presents at every multi-leg or intermodal handoff, not only the identifier carried in the booking system."
          ],
          "detective": [
            "Make it mandatory to record tractor plate, trailer plate and driver identity at loading, and reconcile all three against the dispatch confirmation automatically rather than by eye.",
            "Alert on the same load reference appearing on more than one freight marketplace.",
            "Monitor accounts payable for payment enquiries from entities that are not in the contractual chain, and treat every one as a potential re-brokering disclosure.",
            "Track the share of movements per carrier with no telematics coverage."
          ],
          "responsive": [
            "Suspend further tendering to the entity immediately and freeze open invoices pending reconciliation.",
            "Establish who physically held the cargo and whether that party carried valid liability cover, before settling any claim.",
            "Notify the affected subcontractor directly, since it is a victim of the same scheme and is usually the best source of evidence.",
            "Record the case against the entity and its identified principals, not only against the trading name, so a re-registered successor entity can be recognised."
          ]
        }
      },
      {
        "id": "FFT-002",
        "name": "Phantom Carrier",
        "summary": "An entity is created for the specific purpose of collecting freight and disappearing. It has no operational history, no real fleet and no intention of delivering. The documentation is fabricated or copied well enough to pass a paperwork-only onboarding check.",
        "severity": "critical",
        "category": "identity",
        "indicators": [
          {
            "phase": "pre_award",
            "signal": "Company registered within the last six to twelve months with no verifiable transport operating history",
            "observable_in": "Commercial register and operator licence register",
            "weight": 3,
            "notes": "New companies are legitimate and common. Weight comes from combination, not from newness alone."
          },
          {
            "phase": "pre_award",
            "signal": "Registered address is a virtual office, mailbox service, or an address shared with unrelated companies",
            "observable_in": "Commercial register address, compared against known virtual-office providers",
            "weight": 4
          },
          {
            "phase": "pre_award",
            "signal": "Insurance certificate is supplied as an image or edited document rather than confirmed by the insurer or broker directly",
            "observable_in": "Onboarding document set",
            "weight": 4,
            "notes": "See FFT-011 for the detail of certificate fraud."
          },
          {
            "phase": "pre_award",
            "signal": "Bids concentrate almost exclusively on high value-density, easily resold commodities such as consumer electronics, pharmaceuticals, tobacco, or branded apparel",
            "observable_in": "Bid history by commodity class",
            "weight": 3
          },
          {
            "phase": "pre_award",
            "signal": "Contact identity has no verifiable footprint: no traceable landline, no consistent business presence, personal email domain",
            "observable_in": "Contact verification during onboarding",
            "weight": 2
          },
          {
            "phase": "in_transit",
            "signal": "Vehicle presenting at pickup carries no operator livery and plates are not registered to the contracting entity",
            "observable_in": "Gate check and plate verification",
            "weight": 5
          },
          {
            "phase": "in_transit",
            "signal": "All contact stops immediately after loading and the vehicle stops reporting position",
            "observable_in": "Visibility platform and dispatch contact log",
            "weight": 5
          },
          {
            "phase": "post_event",
            "signal": "Registered address, on inspection, has no transport operation at it",
            "observable_in": "Site verification or local enquiry",
            "weight": 5
          },
          {
            "phase": "post_event",
            "signal": "The same principals or the same address reappear behind a newly registered entity",
            "observable_in": "Register of directors and shareholders across entities",
            "weight": 4,
            "notes": "This is what makes the pattern repeatable, and why case records must be kept against people and addresses, not just trading names."
          },
          {
            "phase": "in_transit",
            "signal": "The same vehicle registration plate is presented for two different movements within a window too short for the vehicle to have plausibly completed the first",
            "observable_in": "Gate check-in log cross-referenced by plate across concurrent or near-concurrent movements",
            "weight": 5,
            "notes": "A hard signal: physically the same plate cannot be in two places performing two deliveries at once."
          },
          {
            "phase": "pre_award",
            "signal": "Volume accepted by a newly onboarded operator sits persistently just under a tier threshold that would trigger increased scrutiny, then rises sharply once the tier resets",
            "observable_in": "Volume-over-time profile compared against the operator's tenure-based tier thresholds",
            "weight": 3,
            "notes": "Weak alone, but worth flagging when paired with any other pre-award indicator, since it suggests the threshold itself is known and being worked around."
          },
          {
            "phase": "post_event",
            "signal": "The same vehicle or trailer asset appears across several otherwise-unrelated carrier identities, more than one of which has already been suspended for cause",
            "observable_in": "Asset registration records cross-referenced across carrier master data",
            "weight": 4
          }
        ],
        "countermeasures": {
          "preventive": [
            "Verify operating authority, insurance and tax identifiers at source with the issuing body, and never accept a counterparty-supplied document as the primary evidence.",
            "Require the operational depot address separately from the registered address, and verify it independently.",
            "Apply a graduated exposure limit to new counterparties: cap cargo value and prohibit high-risk commodity classes until a delivery history exists.",
            "Screen the registered address and the named principals against prior incident records before award, not only the company name."
          ],
          "detective": [
            "Automatically flag a first-time counterparty bidding on a load above a defined value threshold for manual release.",
            "Reconcile plate and driver identity at the gate against the dispatch record, and hold the load if they do not match.",
            "Alert when position reporting and contact both cease within the first hours after loading, rather than waiting for the delivery window to close."
          ],
          "responsive": [
            "Treat a non-contactable carrier holding loaded cargo as a theft in progress and escalate to law enforcement immediately rather than as a service failure.",
            "Preserve the full onboarding document set, correspondence and gate photographs as evidence before any account is closed.",
            "Record the incident against principals, addresses, bank accounts and telephone numbers so a re-registered successor can be matched.",
            "Share the identifiers through the relevant industry or law enforcement channel, since these entities move between shippers rapidly."
          ]
        }
      },
      {
        "id": "FFT-003",
        "name": "Carrier Identity Takeover",
        "summary": "Rather than inventing a company, the perpetrator adopts the identity of a real, licensed operator, typically one that is dormant, recently sold, or simply obscure. Every credential presented checks out because it belongs to a genuine business. Only the contact details, and the party actually collecting the freight, are substituted.",
        "severity": "critical",
        "category": "identity",
        "indicators": [
          {
            "phase": "pre_award",
            "signal": "Contact domain is a close variant of the operator's genuine domain, differing by a character, a suffix or a top-level domain",
            "observable_in": "Onboarding contact record compared with the domain historically associated with the licence holder",
            "weight": 5,
            "notes": "The strongest single indicator of this pattern, and cheap to check."
          },
          {
            "phase": "pre_award",
            "signal": "Contact telephone or email details for a known licence number have changed recently and the change was not initiated through an existing relationship",
            "observable_in": "Change history on the carrier master record",
            "weight": 4
          },
          {
            "phase": "pre_award",
            "signal": "Bank details supplied do not match the account name of the licensed operator, or are held in a different country from the operator",
            "observable_in": "Payment master data",
            "weight": 5
          },
          {
            "phase": "pre_award",
            "signal": "Licence is valid but the operator has no recent activity, filings or movements",
            "observable_in": "Register filing history and any available activity data",
            "weight": 3
          },
          {
            "phase": "in_transit",
            "signal": "Equipment presenting at pickup is not registered to the licence holder",
            "observable_in": "Plate verification at gate",
            "weight": 5
          },
          {
            "phase": "post_event",
            "signal": "The genuine operator denies all knowledge of the movement when contacted on independently obtained details",
            "observable_in": "Direct verification using details from the register, not from the tender",
            "weight": 5,
            "notes": "Always re-contact using details obtained independently. Contacting the number supplied by the perpetrator simply reaches the perpetrator."
          },
          {
            "phase": "in_transit",
            "signal": "Two separate individuals independently present valid-looking credentials for the same movement within a short window, each passing identity verification on its own",
            "observable_in": "Gate or check-in identity log for the movement, compared against the credential history for the assigned driver",
            "weight": 5,
            "notes": "Distinct from simple plate mismatch: both credentials individually check out, only the duplication across two people reveals the problem."
          }
        ],
        "countermeasures": {
          "preventive": [
            "Treat any change to contact details or bank details on an existing carrier record as a high-risk event requiring out-of-band verification through the previously known channel.",
            "Bind the carrier master record to a verified domain and telephone number, and alert on any deviation at tender.",
            "Require that the payee name match the licensed operator, or that a verified factoring assignment be on file.",
            "Verify licence status and licence-holder identity together, rather than checking only that a licence number is valid."
          ],
          "detective": [
            "Run automated lookalike-domain detection against the domains of onboarded carriers.",
            "Flag tenders where a dormant licence suddenly becomes commercially active.",
            "Reconcile equipment registration against licence holder at the gate."
          ],
          "responsive": [
            "Notify the impersonated operator, which is a victim and will usually cooperate, and which may already hold evidence.",
            "Preserve the lookalike domain, email headers, telephone numbers and bank details, since these are the artefacts that link cases together.",
            "Report to the licensing authority, because impersonation of a licence holder affects the integrity of the register itself.",
            "Re-verify all counterparties onboarded in the same period through the same channel, since these campaigns rarely target a single shipper."
          ]
        }
      },
      {
        "id": "FFT-004",
        "name": "Fictitious Pickup",
        "summary": "Cargo is handed over voluntarily at the loading point to someone who is not entitled to it. No lock is forced and no vehicle is broken into, which is what makes this pattern both effective and difficult to classify: operationally it looks like a normal collection, and the loss is often first recorded as a delivery failure rather than a theft.",
        "severity": "critical",
        "category": "cargo_loss",
        "indicators": [
          {
            "phase": "pre_award",
            "signal": "Requests for load reference numbers, collection windows or consignee detail arrive from an unverified channel",
            "observable_in": "Correspondence with the booking desk",
            "weight": 3
          },
          {
            "phase": "in_transit",
            "signal": "Driver arrives early, ahead of the booked window, and applies pressure to be loaded quickly",
            "observable_in": "Gate log and dock staff observation",
            "weight": 3,
            "notes": "Common enough legitimately that it must be combined with an identity mismatch to carry weight."
          },
          {
            "phase": "in_transit",
            "signal": "Driver identity document does not match the name on the dispatch confirmation",
            "observable_in": "Driver ID check at gate",
            "weight": 5
          },
          {
            "phase": "in_transit",
            "signal": "Tractor or trailer plate does not match the dispatch record",
            "observable_in": "Plate check at gate",
            "weight": 5
          },
          {
            "phase": "in_transit",
            "signal": "Paperwork is presented as a photograph or printout with inconsistent formatting, or the driver cannot produce the transport order through the carrier's own system",
            "observable_in": "Document inspection at gate",
            "weight": 4
          },
          {
            "phase": "in_transit",
            "signal": "Two vehicles present for the same load reference",
            "observable_in": "Gate log",
            "weight": 5,
            "notes": "Effectively conclusive, and the reason gate logs should be checked against open bookings in real time rather than reconciled later."
          },
          {
            "phase": "post_event",
            "signal": "The contracted carrier reports arriving to find the load already collected",
            "observable_in": "Carrier exception report",
            "weight": 5
          }
        ],
        "countermeasures": {
          "preventive": [
            "Issue a single-use collection code per booking, communicated to the carrier through the established channel and required at the gate.",
            "Make release conditional on a three-way match of driver identity, vehicle registration and booking reference, with no discretion to override under time pressure.",
            "Restrict distribution of load reference and consignee data to parties with a verified need, and treat unsolicited requests for it as a security event.",
            "Give dock staff explicit authority to refuse loading on an identity mismatch, and remove any performance metric that penalises them for doing so."
          ],
          "detective": [
            "Check the gate log against open bookings in real time so that a second presentation for the same reference is caught while the vehicle is still on site.",
            "Photograph vehicle, plate and driver document at every collection and retain the images against the booking.",
            "Alert when a collection is recorded outside the booked window."
          ],
          "responsive": [
            "Treat the event as a theft from the moment of the mismatch, not from the expiry of the delivery window, since the first hours determine whether recovery is possible.",
            "Preserve gate photographs, access-control records and CCTV immediately, before routine retention periods overwrite them.",
            "Establish how the booking data leaked, since a fictitious pickup requires information that was obtained from somewhere and the leak will otherwise be used again.",
            "Notify the genuine carrier, which is a witness and may be able to identify the impersonating party."
          ]
        }
      },
      {
        "id": "FFT-005",
        "name": "Systematic Pilferage",
        "summary": "Rather than taking a whole load, small quantities are removed repeatedly across many movements. Each individual shortage is small enough to be absorbed as a discrepancy, written off, or blamed on miscount at origin. The pattern is only visible in aggregate, which is why it can persist for long periods and why it is frequently the most expensive fraud class in cumulative terms.",
        "severity": "medium",
        "category": "cargo_loss",
        "indicators": [
          {
            "phase": "post_event",
            "signal": "Shortage rate for a specific route, driver, transfer point or consignee is persistently above the network baseline",
            "observable_in": "Discrepancy data aggregated by dimension rather than by event",
            "weight": 4,
            "notes": "This pattern is invisible at event level by design. Detection is entirely a matter of aggregation."
          },
          {
            "phase": "post_event",
            "signal": "Shortages cluster on high value-density, easily resold items within otherwise mixed consignments",
            "observable_in": "Discrepancy records by SKU class",
            "weight": 4
          },
          {
            "phase": "post_event",
            "signal": "Shortage quantities sit consistently just below the threshold that would trigger a formal investigation",
            "observable_in": "Discrepancy value distribution against the escalation threshold",
            "weight": 5,
            "notes": "A distribution that bunches immediately under a control threshold indicates knowledge of the threshold, which narrows the population considerably."
          },
          {
            "phase": "post_event",
            "signal": "Discrepancies persist on a lane after the consignee and origin count processes have both been independently verified",
            "observable_in": "Reconciliation after controlled count",
            "weight": 4
          },
          {
            "phase": "in_transit",
            "signal": "Unexplained stops, or dwell time materially above the corridor norm, correlate with the affected movements",
            "observable_in": "Telematics stop analysis",
            "weight": 3
          },
          {
            "phase": "in_transit",
            "signal": "Seal number recorded at destination differs from the number recorded at origin, or the seal is reported as replaced in transit",
            "observable_in": "Seal record",
            "weight": 4,
            "notes": "See FFT-007."
          }
        ],
        "countermeasures": {
          "preventive": [
            "Use tamper-evident, uniquely numbered seals and record the number at every custody transfer rather than only at origin and destination.",
            "Segregate high value-density items and apply a distinct handling and verification regime rather than the general one.",
            "Rotate assignment of drivers and handlers on affected lanes, which both disrupts an established scheme and provides a natural control comparison.",
            "Avoid publishing internal investigation thresholds, since a known threshold is a target to stay beneath."
          ],
          "detective": [
            "Aggregate discrepancies continuously by route, driver, vehicle, transfer point, consignee and SKU class, and alert on sustained deviation from baseline rather than on individual events.",
            "Monitor the distribution of shortage values for bunching immediately below control thresholds.",
            "Reconcile seal numbers at every custody change automatically.",
            "Correlate discrepancy events against unplanned stops and dwell outliers in telematics data."
          ],
          "responsive": [
            "Establish process error or theft with a controlled count before any accusation, because this pattern has a genuinely high false-positive rate.",
            "Preserve seal records, telematics history and handover documentation for the whole affected period, not only for the triggering event.",
            "Quantify cumulative rather than per-event loss when deciding on proportionate response, since the per-event figure systematically understates the harm.",
            "Review whether the escalation threshold itself created the pattern, and change it if the distribution suggests it was known."
          ]
        }
      },
      {
        "id": "FFT-006",
        "name": "Unsecured Parking Theft",
        "summary": "Cargo is taken from a stationary vehicle at an unsecured stop, most often during a statutory rest period at night. This is the highest-volume cargo crime pattern in European road freight and it is overwhelmingly a function of where and when a vehicle stops rather than of who is carrying it.",
        "severity": "high",
        "category": "cargo_loss",
        "indicators": [
          {
            "phase": "pre_award",
            "signal": "Planned route and schedule force a rest period in a corridor segment with no certified secure parking within range",
            "observable_in": "Route plan compared against secure parking availability",
            "weight": 4,
            "notes": "This is the key preventable exposure, and it is visible before the vehicle ever moves."
          },
          {
            "phase": "pre_award",
            "signal": "High value-density commodity is planned to move in a soft-sided trailer",
            "observable_in": "Load plan and equipment type",
            "weight": 4
          },
          {
            "phase": "in_transit",
            "signal": "Overnight stop recorded at a location that is not a certified secure parking area",
            "observable_in": "Telematics stop location against secure parking registry",
            "weight": 4
          },
          {
            "phase": "in_transit",
            "signal": "Stop duration of several hours in a known high-incidence corridor segment",
            "observable_in": "Telematics dwell analysis against incident geography",
            "weight": 3
          },
          {
            "phase": "in_transit",
            "signal": "Trailer door or curtain sensor triggers during a rest period",
            "observable_in": "Trailer intrusion sensor, where fitted",
            "weight": 5
          },
          {
            "phase": "post_event",
            "signal": "Loss discovered at delivery with no identified stop, indicating that stop-level visibility is absent",
            "observable_in": "Claim narrative and telematics coverage",
            "weight": 3,
            "notes": "Not an indicator of the crime so much as of a control gap that makes this pattern viable and unattributable."
          },
          {
            "phase": "in_transit",
            "signal": "A brief unscheduled stop occurs at an unregistered location shortly before final delivery, too short for a rest break but long enough for partial unloading",
            "observable_in": "Route/telematics stop analysis correlated against the scheduled journey and expected rest requirements",
            "weight": 4,
            "notes": "The 'last mile' variant of this pattern: cargo is diverted just before arrival rather than during a long overnight stop, so it is easy to miss if only long stops are reviewed."
          }
        ],
        "countermeasures": {
          "preventive": [
            "Plan routes so that every statutory rest falls within reach of a certified secure parking area, and treat a route that cannot meet this as an exception requiring approval.",
            "Move high value-density commodities in hard-sided or rigid equipment rather than soft-sided trailers.",
            "Prohibit overnight stops in identified high-incidence corridor segments through contractual route and stop policy, not through guidance alone.",
            "Where a soft-sided trailer is unavoidable, fit anti-slash curtain material and intrusion detection."
          ],
          "detective": [
            "Geofence certified secure parking areas and alert on any rest period taken outside them.",
            "Alert on stop duration above a corridor-specific threshold in segments with elevated incident history.",
            "Fit and monitor door and curtain sensors so that the loss is detected at the stop rather than at the delivery."
          ],
          "responsive": [
            "Report immediately with the precise stop location and time window, since recovery and investigation both depend on narrowing these.",
            "Feed the confirmed location back into route and parking policy, so that corridor risk assessment reflects observed rather than assumed exposure.",
            "Review whether the schedule itself made a compliant secure stop impossible, and correct the planning rule rather than the driver."
          ]
        }
      },
      {
        "id": "FFT-007",
        "name": "Seal Tampering and Reseal Fraud",
        "summary": "A load is accessed and then closed again with a substituted or reapplied seal so that the consignment appears intact on arrival. The purpose is not to hide the cargo loss forever but to move the point of apparent loss away from the party responsible, usually by making it look like a shortage at origin.",
        "severity": "medium",
        "category": "documentary",
        "indicators": [
          {
            "phase": "post_event",
            "signal": "Seal number recorded at destination does not match the number recorded at origin",
            "observable_in": "Seal record at both ends",
            "weight": 5,
            "notes": "Conclusive of substitution, but only detectable if the number is actually recorded at both ends. In practice the control most often fails because the number is never captured, not because it matches."
          },
          {
            "phase": "post_event",
            "signal": "Seal is intact but the consignment is short",
            "observable_in": "Delivery count against seal status",
            "weight": 4
          },
          {
            "phase": "post_event",
            "signal": "Seal type, colour or issuer differs from the one issued at origin",
            "observable_in": "Photograph of seal at delivery",
            "weight": 4
          },
          {
            "phase": "in_transit",
            "signal": "Seal reported as broken and replaced in transit for an operational reason, such as an inspection, without independent corroboration",
            "observable_in": "In-transit exception report",
            "weight": 3,
            "notes": "Legitimate inspections do break seals. The indicator is the absence of corroborating authority documentation, not the replacement itself."
          },
          {
            "phase": "post_event",
            "signal": "Physical evidence of defeat on the seal body: heat marks, adhesive residue, misaligned serial, deformation",
            "observable_in": "Physical inspection of the retained seal",
            "weight": 4
          },
          {
            "phase": "post_event",
            "signal": "Seals for a lane are drawn from a range that is not centrally controlled, or the sequence has gaps",
            "observable_in": "Seal issue and reconciliation log",
            "weight": 3
          },
          {
            "phase": "post_event",
            "signal": "Trailer or container shows evidence of forced physical entry, such as a broken locking mechanism, a pried door or a cut curtain, rather than a defeated or substituted seal",
            "observable_in": "Physical inspection of the unit at delivery or at an intermediate custody check",
            "weight": 5,
            "notes": "Distinct from the stealthier reseal indicators above: a blunt forced-entry event is not trying to look like an intact, undisturbed load, so it points to a different actor profile and a different response (immediate physical recovery effort, not paperwork reconciliation)."
          }
        ],
        "countermeasures": {
          "preventive": [
            "Use uniquely numbered, tamper-evident seals drawn from a centrally controlled and reconciled range.",
            "Require the seal number to be captured photographically at every custody transfer, not only at origin and destination.",
            "Define and communicate a single lawful procedure for in-transit reseal, requiring authority documentation and immediate notification.",
            "Never allow the party transporting the cargo to hold uncontrolled stock of blank seals for the lanes it operates."
          ],
          "detective": [
            "Automatically reconcile seal numbers at every recorded custody change and raise an exception on any mismatch.",
            "Reconcile issued against used seal ranges periodically and investigate gaps.",
            "Retain seals from any consignment with a discrepancy for physical inspection rather than discarding them at the dock."
          ],
          "responsive": [
            "Retain the physical seal as evidence, since defeat characteristics are the most reliable proof available and are lost once it is discarded.",
            "Establish the last custody point at which the original number was independently verified, which bounds the responsible segment.",
            "Verify any claimed authority inspection directly with that authority.",
            "Treat a lane where seal numbers are not captured at intermediate custody changes as an unmeasured risk rather than a low risk."
          ]
        }
      },
      {
        "id": "FFT-008",
        "name": "GPS Spoofing and Telematics Manipulation",
        "summary": "The position or movement data a shipper relies on is deliberately falsified or suppressed, so that a vehicle appears to be somewhere it is not, or appears to be moving normally while it is stopped. The purpose is to remove the time window and location that any investigation would otherwise start from.",
        "severity": "high",
        "category": "digital",
        "indicators": [
          {
            "phase": "in_transit",
            "signal": "Position jumps a distance that could not be covered in the elapsed time",
            "observable_in": "Telematics track, tested for physical plausibility between consecutive fixes",
            "weight": 5,
            "notes": "A simple speed-plausibility check between consecutive fixes catches most crude spoofing and is rarely implemented."
          },
          {
            "phase": "in_transit",
            "signal": "Reported position is static or repeats identically while engine, odometer or fuel data indicate motion",
            "observable_in": "Cross-comparison of position against independent vehicle telemetry",
            "weight": 5,
            "notes": "Cross-source contradiction is the most reliable detection available, because falsifying every channel consistently is difficult."
          },
          {
            "phase": "in_transit",
            "signal": "Complete loss of signal in an area with no known coverage problem, particularly during a rest period",
            "observable_in": "Telematics gap analysis against known coverage",
            "weight": 4
          },
          {
            "phase": "in_transit",
            "signal": "Reported satellite count or signal quality drops abruptly to an implausible value while the vehicle is in open terrain",
            "observable_in": "Receiver diagnostic fields, where exposed by the platform",
            "weight": 4
          },
          {
            "phase": "in_transit",
            "signal": "Signal loss events recur on the same driver, vehicle or corridor segment rather than being distributed randomly",
            "observable_in": "Gap events aggregated by dimension",
            "weight": 4
          },
          {
            "phase": "post_event",
            "signal": "Telematics unit found disconnected, powered down, or physically shielded on inspection",
            "observable_in": "Vehicle inspection after the event",
            "weight": 5
          },
          {
            "phase": "in_transit",
            "signal": "A location-based arrival or departure stamp is recorded within seconds of check-in, with no corroborating confirmation from an independent yard or gate system",
            "observable_in": "Cross-check between an app-based geolocation stamp and an independent yard-management or gate-log record for the same event",
            "weight": 4,
            "notes": "Distinct from the position-jump/signal-loss indicators above: here the device is working normally, but the stamp itself is being used as unearned proof of a physical event that an independent system does not corroborate."
          }
        ],
        "countermeasures": {
          "preventive": [
            "Do not rely on a single position source. Combine satellite position with independent vehicle telemetry such as odometer, engine state or fuel, so that falsifying one channel produces a detectable contradiction.",
            "Mount and wire telematics so that disconnection is not accessible without evident tampering, and alert on power loss.",
            "Use tamper-evident sealing on the unit and include its integrity in the pre-departure check.",
            "Fit independent trailer-side tracking on high-value movements so that tractor-side manipulation does not blind the whole movement."
          ],
          "detective": [
            "Run automated speed and distance plausibility checks between consecutive fixes and alert on physically impossible transitions.",
            "Alert on any position gap above a defined duration, and treat gaps during rest periods as higher priority than gaps in motion.",
            "Aggregate signal-loss events by driver, vehicle, corridor and hardware version to separate deliberate from technical causes.",
            "Compare individual gaps against fleet-wide loss in the same area and window before escalating."
          ],
          "responsive": [
            "Inspect and photograph the telematics installation before the vehicle re-enters service, since physical evidence of tampering disappears quickly.",
            "Preserve raw position and diagnostic data rather than the platform's cleaned track, because the artefacts that prove spoofing are usually removed by smoothing.",
            "Reconstruct the movement from independent sources such as toll, fuel, weighbridge and access-control records.",
            "Check published regional interference reporting for the period before attributing a gap to the driver."
          ]
        }
      },
      {
        "id": "FFT-009",
        "name": "Insider Collusion",
        "summary": "A person with legitimate access supplies information or suppresses a control so that an external party can take cargo. The insider rarely handles the goods. What they provide is far more valuable: knowledge of which load is worth taking, when it moves, and which check will not be performed.",
        "severity": "critical",
        "category": "insider",
        "indicators": [
          {
            "phase": "post_event",
            "signal": "Losses concentrate on consignments whose value was known internally but not externally visible from packaging or documentation",
            "observable_in": "Comparison of loss set against externally observable value cues",
            "weight": 5,
            "notes": "The strongest structural indicator. If the targeting could not have been done from outside, it was informed from inside."
          },
          {
            "phase": "post_event",
            "signal": "Events cluster on a specific shift, gate, workstation or supervisory approval rather than distributing across the operation",
            "observable_in": "Loss events aggregated by shift, location and approver",
            "weight": 4
          },
          {
            "phase": "post_event",
            "signal": "The control that would have caught the loss was, in each case, the one not performed or performed by the same individual",
            "observable_in": "Control execution log against loss events",
            "weight": 4
          },
          {
            "phase": "in_transit",
            "signal": "Access, override or exception authority used outside the pattern normal for that role",
            "observable_in": "System access and override logs",
            "weight": 3
          },
          {
            "phase": "post_event",
            "signal": "Losses stop abruptly during an unannounced audit or a staffing change and resume afterwards",
            "observable_in": "Loss timeline against audit and roster changes",
            "weight": 5,
            "notes": "Close to conclusive when it recurs, and it is the reason unannounced controls are worth more than scheduled ones."
          },
          {
            "phase": "pre_award",
            "signal": "Undisclosed relationship between an employee with award or approval authority and a counterparty",
            "observable_in": "Conflict-of-interest declaration compared against register data",
            "weight": 4
          },
          {
            "phase": "in_transit",
            "signal": "A driver or check-in credential is used to authorise pickup from two locations that are inconsistent with realistic travel time between them",
            "observable_in": "Credential/session usage log compared against the geolocation of the device used to authenticate",
            "weight": 4,
            "notes": "Usually indicates a shared, sold or stolen credential rather than the named individual acting alone."
          }
        ],
        "countermeasures": {
          "preventive": [
            "Separate the person who knows a consignment's value from the person who executes the release, so that neither role alone is sufficient.",
            "Restrict visibility of consignment value on a need-to-know basis rather than exposing it throughout the operation.",
            "Require conflict-of-interest declarations from anyone with award, approval or override authority, and reconcile them against register data rather than accepting them at face value.",
            "Rotate assignments and approvers on high-value flows and use mandatory leave to create natural control gaps."
          ],
          "detective": [
            "Aggregate loss events by shift, gate, workstation and approving individual, normalised by volume handled.",
            "Monitor override and exception authority for use outside role-normal patterns.",
            "Run unannounced controls and compare loss rates during and outside them.",
            "Maintain a confidential reporting channel and treat reports as an evidential lead rather than a personnel complaint."
          ],
          "responsive": [
            "Preserve access logs, CCTV and rosters before initiating any interview, since these are the records most likely to be lost once the investigation becomes known.",
            "Normalise by exposure before drawing any conclusion about an individual, because this pattern has the highest personal cost of a wrong call in the entire taxonomy.",
            "Involve HR and legal from the outset so that evidence remains usable and the process remains defensible.",
            "Close the information asymmetry that made targeting possible, since replacing the individual without changing the access does not close the exposure."
          ]
        }
      },
      {
        "id": "FFT-010",
        "name": "Transport Document Fraud",
        "summary": "The documents that establish what was carried, in what condition, and to whom it was released are altered, forged or reused. The cargo may never be missing at all: the purpose is often to shift liability, to support a claim, or to obtain payment for a delivery that did not occur as documented.",
        "severity": "medium",
        "category": "documentary",
        "indicators": [
          {
            "phase": "post_event",
            "signal": "Proof of delivery signature cannot be attributed to any person authorised by the consignee to receive goods",
            "observable_in": "Consignee verification of the signatory",
            "weight": 5
          },
          {
            "phase": "post_event",
            "signal": "Document metadata, sequence number or timestamp is inconsistent with the movement it purports to evidence",
            "observable_in": "Document set compared with telematics and system timestamps",
            "weight": 4
          },
          {
            "phase": "post_event",
            "signal": "The same document image or reference appears against more than one movement",
            "observable_in": "Document deduplication across the claims and delivery record",
            "weight": 5,
            "notes": "Reuse is one of the easiest patterns to detect automatically and one of the least often checked."
          },
          {
            "phase": "post_event",
            "signal": "Condition or quantity annotations appear in different ink, hand, font or layer from the rest of the document",
            "observable_in": "Physical or forensic inspection of the original",
            "weight": 4
          },
          {
            "phase": "post_event",
            "signal": "Reservations about apparent condition are absent on taking over the goods but a claim later relies on pre-existing damage",
            "observable_in": "Consignment note reservations against the claim narrative",
            "weight": 4
          },
          {
            "phase": "in_transit",
            "signal": "Only a photographed or retyped copy is ever provided and the original is said to be unavailable",
            "observable_in": "Document handling record",
            "weight": 3,
            "notes": "Common in legitimate operations, so weak on its own; it matters because it removes the ability to test the other indicators."
          },
          {
            "phase": "post_event",
            "signal": "A police or incident report submitted in support of a loss claim does not match the claimed location or timeline when checked against independently obtained records",
            "observable_in": "Cross-check of the submitted report's stated location and timeline against an independently obtained copy or confirmation from the reporting authority",
            "weight": 4,
            "notes": "Always re-verify through the authority directly rather than relying solely on the copy supplied by the party making the claim."
          }
        ],
        "countermeasures": {
          "preventive": [
            "Move to electronic consignment notes with authenticated, timestamped signature capture, which removes most of the alteration surface.",
            "Maintain a verified list of persons authorised to receive at each consignee site, and require identification at handover.",
            "Require reservations about apparent condition to be recorded at handover, with photographs, rather than accepted later.",
            "Retain originals under controlled custody rather than accepting images as the record of truth."
          ],
          "detective": [
            "Deduplicate delivery documents automatically by image hash and reference across movements and claims.",
            "Reconcile document timestamps against telematics arrival and departure data and flag inconsistencies.",
            "Sample-verify delivery signatures directly with consignees rather than only when a claim arises.",
            "Flag claims that rely on a document for which no original can be produced."
          ],
          "responsive": [
            "Secure the original document before any dispute is progressed, since the evidential value of a copy is limited.",
            "Verify the signatory with the consignee directly rather than through the party relying on the document.",
            "Reconstruct the movement from independent records such as telematics, gate, toll and access logs, which cannot be retrospectively edited as easily.",
            "Treat a lane on which originals are routinely unavailable as an unmeasured liability exposure."
          ]
        }
      },
      {
        "id": "FFT-011",
        "name": "Insurance Certificate Fraud",
        "summary": "A carrier presents evidence of liability or cargo cover that is forged, expired, cancelled, or materially narrower than it appears. Nothing is detected until a claim is made, at which point the shipper discovers it has been carrying uninsured exposure across every movement that carrier performed.",
        "severity": "high",
        "category": "financial",
        "indicators": [
          {
            "phase": "pre_award",
            "signal": "Certificate supplied as an image or editable document rather than confirmed directly by the insurer or broker",
            "observable_in": "Onboarding document set and verification record",
            "weight": 4,
            "notes": "The core structural weakness. Verification at source removes most of this pattern at negligible cost."
          },
          {
            "phase": "pre_award",
            "signal": "Insurer, broker or policy reference cannot be verified, or the insurer is not authorised in the relevant market",
            "observable_in": "Regulator's register of authorised insurers",
            "weight": 5
          },
          {
            "phase": "pre_award",
            "signal": "Cover limits are exactly at, or suspiciously aligned with, the shipper's stated minimum",
            "observable_in": "Certificate limits against the contractual minimum",
            "weight": 2
          },
          {
            "phase": "pre_award",
            "signal": "Policy period ends before the contract term, or renewal evidence is never provided",
            "observable_in": "Certificate validity dates against contract dates",
            "weight": 4
          },
          {
            "phase": "pre_award",
            "signal": "Cover excludes the commodity class, territory, equipment type or theft peril actually being carried",
            "observable_in": "Policy wording rather than the certificate summary",
            "weight": 5,
            "notes": "The exclusion is frequently the real exposure. A certificate can be perfectly genuine and still provide no cover for the movement at hand."
          },
          {
            "phase": "post_event",
            "signal": "Insurer declines on the basis of cancellation, non-disclosure or non-payment predating the loss",
            "observable_in": "Claim correspondence",
            "weight": 5
          }
        ],
        "countermeasures": {
          "preventive": [
            "Verify cover directly with the insurer or broker at onboarding and never accept a counterparty-supplied document as primary evidence.",
            "Read the policy wording for exclusions relevant to the commodity, territory, equipment and perils actually being moved, rather than relying on the certificate summary.",
            "Require notice of cancellation or material change to be given to the shipper as a contractual term.",
            "Check that the insurer is authorised in the relevant market."
          ],
          "detective": [
            "Track certificate expiry dates automatically and suspend tendering when evidence of renewal is not on file, rather than treating expiry as an administrative backlog.",
            "Re-verify cover with the insurer periodically for carriers above a defined exposure level, not only at onboarding.",
            "Reconcile the commodity and territory actually tendered against the scope of cover on file, and alert on movements outside it."
          ],
          "responsive": [
            "Quantify the full uninsured exposure across every movement the carrier performed in the affected period, not only the movement that produced the claim.",
            "Preserve the certificate as supplied, since it is the evidence of misrepresentation.",
            "Report a forged certificate to the named insurer, which has its own interest in the forgery and may already have other cases.",
            "Review whether other carriers were onboarded through the same unverified route and re-verify that whole cohort."
          ]
        }
      },
      {
        "id": "FFT-012",
        "name": "Undisclosed Subcontracting Chain",
        "summary": "The contracted carrier is not the performing carrier, and neither is the party it engaged. Each tier is individually lawful, but the chain is undisclosed, so the shipper cannot identify who is physically carrying its goods. This defeats sanctions screening, cabotage and posting compliance, insurance verification and human-rights due diligence simultaneously, because all of them depend on knowing the identity of the actual performing party.",
        "severity": "high",
        "category": "regulatory",
        "indicators": [
          {
            "phase": "pre_award",
            "signal": "Contract permits subcontracting without any obligation to disclose the identity of the performing party",
            "observable_in": "Transport contract terms",
            "weight": 4,
            "notes": "This is a control design defect rather than a behavioural signal, and it is where the exposure originates."
          },
          {
            "phase": "pre_award",
            "signal": "Contracted volume is materially greater than the entity's own declared capacity, implying routine subcontracting",
            "observable_in": "Awarded volume against declared fleet capacity",
            "weight": 4
          },
          {
            "phase": "in_transit",
            "signal": "Vehicle or driver at pickup belongs to an entity that does not appear anywhere in the shipper's records",
            "observable_in": "Gate record against contractual chain",
            "weight": 5,
            "notes": "The gate is the only place the real performing party reliably becomes visible."
          },
          {
            "phase": "in_transit",
            "signal": "Vehicle registration country and driver nationality pattern are inconsistent with the declared operator's establishment",
            "observable_in": "Gate record and transport documentation",
            "weight": 3
          },
          {
            "phase": "post_event",
            "signal": "Claims, penalties or enforcement notices name an entity absent from the shipper's carrier master data",
            "observable_in": "Claims and enforcement correspondence",
            "weight": 5
          },
          {
            "phase": "post_event",
            "signal": "Sanctions or adverse-media screening produces a hit on a party discovered only after an incident",
            "observable_in": "Retrospective screening of the actual performing party",
            "weight": 5,
            "notes": "By this point the exposure has already been carried, which is the whole problem with screening only tier one."
          }
        ],
        "countermeasures": {
          "preventive": [
            "Require disclosure of the performing party before collection as a contractual condition, and make non-disclosure a breach rather than a service issue.",
            "Maintain an approved-subcontractor list and prohibit tiers beyond a defined depth for high-value or high-risk movements.",
            "Flow down sanctions screening, insurance verification and labour-standards obligations contractually to every tier, with audit rights.",
            "Screen the performing party, not only the contracting party, before release."
          ],
          "detective": [
            "Reconcile the operator identity captured at the gate against the contractual chain automatically, and treat any unknown entity as an exception requiring resolution.",
            "Re-screen the actual performing parties periodically against sanctions and adverse-media sources rather than screening tier one at onboarding only.",
            "Monitor the ratio of awarded volume to declared capacity per carrier as a proxy for undisclosed subcontracting.",
            "Reconcile claims and enforcement correspondence against carrier master data and investigate every unrecognised entity."
          ],
          "responsive": [
            "Reconstruct the full chain for the affected movements and screen every identified tier retrospectively.",
            "Assess whether the opacity itself constitutes a due-diligence failure, since the obligation attaches to the risk and not to the paperwork.",
            "Document the finding and the remediation, because under the German regime the documentation of the analysis and the measures is itself the compliance artefact.",
            "Close the contractual gap that permitted undisclosed subcontracting before resuming tendering."
          ]
        }
      }
    ]
  },
  "governance": {
    "frameworks": [
      {
        "id": "EUAIA",
        "name": "EU AI Act",
        "citation": "Regulation (EU) 2024/1689 of the European Parliament and of the Council of 13 June 2024",
        "url": "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
        "kind": "regulation",
        "requirements": [
          {
            "id": "EUAIA-4",
            "ref": "Art. 4",
            "title": "AI literacy",
            "summary": "Providers and deployers must ensure a sufficient level of AI literacy among staff and others operating AI systems on their behalf.",
            "applies": {
              "roles": [
                "provider",
                "deployer"
              ],
              "tiers": [
                "prohibited",
                "high",
                "limited",
                "minimal"
              ]
            }
          },
          {
            "id": "EUAIA-5",
            "ref": "Art. 5",
            "title": "Prohibited AI practices",
            "summary": "Certain practices are banned outright, including manipulative techniques causing significant harm, exploitation of vulnerability, social scoring, untargeted facial scraping and workplace or education emotion inference.",
            "applies": {
              "roles": [
                "provider",
                "deployer"
              ],
              "tiers": [
                "prohibited"
              ]
            }
          },
          {
            "id": "EUAIA-6",
            "ref": "Art. 6 + Annex III",
            "title": "High-risk classification",
            "summary": "A system is high-risk if it is a safety component of a regulated product or falls in an Annex III use case, unless a documented derogation assessment shows it does not pose a significant risk.",
            "applies": {
              "roles": [
                "provider",
                "deployer"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-9",
            "ref": "Art. 9",
            "title": "Risk management system",
            "summary": "A continuous, documented, iterative risk management system across the whole lifecycle: identify and evaluate known and foreseeable risks, adopt mitigations, and test that they work.",
            "applies": {
              "roles": [
                "provider"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-10",
            "ref": "Art. 10",
            "title": "Data and data governance",
            "summary": "Training, validation and testing data must be governed: relevance, representativeness, bias examination and mitigation, and documented provenance and preparation.",
            "applies": {
              "roles": [
                "provider"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-11",
            "ref": "Art. 11 + Annex IV",
            "title": "Technical documentation",
            "summary": "Technical documentation drawn up before placing on the market and kept up to date, sufficient to demonstrate conformity to authorities.",
            "applies": {
              "roles": [
                "provider"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-12",
            "ref": "Art. 12",
            "title": "Record-keeping and logging",
            "summary": "Automatic recording of events over the system's lifetime, enabling traceability of situations that may create risk or trigger substantial modification.",
            "applies": {
              "roles": [
                "provider"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-13",
            "ref": "Art. 13",
            "title": "Transparency and information to deployers",
            "summary": "Instructions for use that state capabilities, limitations, accuracy metrics, foreseeable misuse, human oversight measures and expected lifetime.",
            "applies": {
              "roles": [
                "provider"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-14",
            "ref": "Art. 14",
            "title": "Human oversight",
            "summary": "Design and build the system so that natural persons can effectively oversee it: understand its limits, interpret output, decide not to use it, and intervene or stop it.",
            "applies": {
              "roles": [
                "provider",
                "deployer"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-15",
            "ref": "Art. 15",
            "title": "Accuracy, robustness and cybersecurity",
            "summary": "Appropriate levels of accuracy, robustness and cybersecurity throughout the lifecycle, with declared metrics and resilience to error, fault and adversarial attack including data poisoning.",
            "applies": {
              "roles": [
                "provider"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-17",
            "ref": "Art. 17",
            "title": "Quality management system",
            "summary": "A documented QMS covering regulatory compliance strategy, design and testing procedures, data management, risk management, post-market monitoring and accountability.",
            "applies": {
              "roles": [
                "provider"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-26",
            "ref": "Art. 26",
            "title": "Deployer obligations",
            "summary": "Use the system per instructions, assign competent human oversight, ensure input data relevance, monitor operation, keep logs, and inform workers before workplace deployment.",
            "applies": {
              "roles": [
                "deployer"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-27",
            "ref": "Art. 27",
            "title": "Fundamental rights impact assessment",
            "summary": "Certain deployers (public bodies, and private bodies in creditworthiness and life or health insurance pricing) must assess the impact on fundamental rights before first use.",
            "applies": {
              "roles": [
                "deployer"
              ],
              "tiers": [
                "high"
              ],
              "conditions": [
                "fria_trigger"
              ]
            }
          },
          {
            "id": "EUAIA-43",
            "ref": "Art. 43",
            "title": "Conformity assessment",
            "summary": "Undergo the applicable conformity assessment procedure before placing on the market, and again after substantial modification.",
            "applies": {
              "roles": [
                "provider"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-49",
            "ref": "Art. 49",
            "title": "Registration in the EU database",
            "summary": "Register the high-risk system, or the derogation assessment, in the EU database before placing on the market or putting into service.",
            "applies": {
              "roles": [
                "provider",
                "deployer"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-50",
            "ref": "Art. 50",
            "title": "Transparency for specific systems",
            "summary": "Tell people they are interacting with an AI system, mark synthetic content in machine-readable form, and disclose deep fakes and emotion or biometric categorisation.",
            "applies": {
              "roles": [
                "provider",
                "deployer"
              ],
              "tiers": [
                "high",
                "limited"
              ],
              "conditions": [
                "interacts_with_people",
                "generates_content",
                "biometric_categorisation"
              ]
            }
          },
          {
            "id": "EUAIA-53",
            "ref": "Art. 53",
            "title": "General-purpose AI model obligations",
            "summary": "GPAI model providers must keep technical documentation, publish a training-content summary and operate a copyright policy.",
            "applies": {
              "roles": [
                "provider"
              ],
              "conditions": [
                "gpai_model_provider"
              ]
            }
          },
          {
            "id": "EUAIA-72",
            "ref": "Art. 72",
            "title": "Post-market monitoring",
            "summary": "A documented post-market monitoring plan that actively and systematically collects and analyses performance data over the system's lifetime.",
            "applies": {
              "roles": [
                "provider"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-73",
            "ref": "Art. 73",
            "title": "Serious incident reporting",
            "summary": "Report serious incidents to the market surveillance authority of the Member State where the incident occurred, within the deadlines set by the Article.",
            "applies": {
              "roles": [
                "provider",
                "deployer"
              ],
              "tiers": [
                "high"
              ]
            }
          },
          {
            "id": "EUAIA-86",
            "ref": "Art. 86",
            "title": "Right to explanation of individual decisions",
            "summary": "Affected persons subject to an Annex III decision have the right to a clear and meaningful explanation of the role of the AI system in the decision procedure.",
            "applies": {
              "roles": [
                "deployer"
              ],
              "tiers": [
                "high"
              ],
              "conditions": [
                "affects_individuals"
              ]
            }
          }
        ]
      },
      {
        "id": "GDPR",
        "name": "GDPR",
        "citation": "Regulation (EU) 2016/679",
        "url": "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
        "kind": "regulation",
        "requirements": [
          {
            "id": "GDPR-5",
            "ref": "Art. 5",
            "title": "Principles of processing",
            "summary": "Lawfulness, fairness and transparency, purpose limitation, data minimisation, accuracy, storage limitation, integrity and confidentiality, and demonstrable accountability.",
            "applies": {
              "conditions": [
                "personal_data"
              ]
            }
          },
          {
            "id": "GDPR-6",
            "ref": "Art. 6",
            "title": "Lawful basis",
            "summary": "Each processing purpose needs an identified and documented lawful basis; a legitimate-interests basis needs a balancing assessment.",
            "applies": {
              "conditions": [
                "personal_data"
              ]
            }
          },
          {
            "id": "GDPR-9",
            "ref": "Art. 9",
            "title": "Special category data",
            "summary": "Processing of special category data, including biometric data for unique identification, is prohibited unless a specific condition applies.",
            "applies": {
              "conditions": [
                "special_category_data"
              ]
            }
          },
          {
            "id": "GDPR-13",
            "ref": "Art. 13-14",
            "title": "Information to data subjects",
            "summary": "Tell people what is done with their data, including the existence of automated decision-making and the logic involved.",
            "applies": {
              "conditions": [
                "personal_data"
              ]
            }
          },
          {
            "id": "GDPR-15",
            "ref": "Art. 15",
            "title": "Right of access",
            "summary": "People can obtain confirmation, a copy of their data and meaningful information about automated decision-making applied to them.",
            "applies": {
              "conditions": [
                "personal_data"
              ]
            }
          },
          {
            "id": "GDPR-22",
            "ref": "Art. 22",
            "title": "Automated individual decision-making",
            "summary": "Solely automated decisions with legal or similarly significant effect are restricted, and where permitted require human intervention, an explanation and the right to contest.",
            "applies": {
              "conditions": [
                "automated_decision"
              ]
            }
          },
          {
            "id": "GDPR-25",
            "ref": "Art. 25",
            "title": "Data protection by design and by default",
            "summary": "Implement technical and organisational measures, including pseudonymisation and minimisation, at design time and by default.",
            "applies": {
              "conditions": [
                "personal_data"
              ]
            }
          },
          {
            "id": "GDPR-30",
            "ref": "Art. 30",
            "title": "Records of processing",
            "summary": "Maintain a record of processing activities, including purposes, categories, recipients, transfers and retention.",
            "applies": {
              "conditions": [
                "personal_data"
              ]
            }
          },
          {
            "id": "GDPR-32",
            "ref": "Art. 32",
            "title": "Security of processing",
            "summary": "Security appropriate to the risk, including confidentiality, integrity, availability and resilience, and regular testing of measures.",
            "applies": {
              "conditions": [
                "personal_data"
              ]
            }
          },
          {
            "id": "GDPR-35",
            "ref": "Art. 35",
            "title": "Data protection impact assessment",
            "summary": "A DPIA is required where processing is likely to result in high risk, including systematic evaluation by automated means and large-scale special category processing.",
            "applies": {
              "conditions": [
                "dpia_trigger"
              ]
            }
          },
          {
            "id": "GDPR-44",
            "ref": "Art. 44-49",
            "title": "International transfers",
            "summary": "Transfers outside the EEA need an adequacy decision, appropriate safeguards or a derogation, plus a transfer risk assessment where relevant.",
            "applies": {
              "conditions": [
                "third_country_transfer"
              ]
            }
          }
        ]
      },
      {
        "id": "ISO42001",
        "name": "ISO/IEC 42001",
        "citation": "ISO/IEC 42001:2023 - Artificial intelligence management system",
        "url": "https://www.iso.org/standard/81230.html",
        "kind": "management_standard",
        "requirements": [
          {
            "id": "ISO42001-5.2",
            "ref": "Cl. 5.2",
            "title": "AI policy",
            "summary": "Top management establishes an AI policy appropriate to the organisation's purpose, communicated and available to interested parties.",
            "applies": {}
          },
          {
            "id": "ISO42001-6.1.4",
            "ref": "Cl. 6.1.4",
            "title": "AI system impact assessment",
            "summary": "Assess the potential consequences of AI systems for individuals, groups and society throughout the lifecycle.",
            "applies": {}
          },
          {
            "id": "ISO42001-A.2",
            "ref": "Annex A.2",
            "title": "Policies related to AI",
            "summary": "Documented AI policies, reviewed at planned intervals and aligned with other organisational policies.",
            "applies": {}
          },
          {
            "id": "ISO42001-A.3",
            "ref": "Annex A.3",
            "title": "Internal organisation",
            "summary": "Defined AI roles, responsibilities and reporting of concerns, including accountability for AI system outcomes.",
            "applies": {}
          },
          {
            "id": "ISO42001-A.4",
            "ref": "Annex A.4",
            "title": "Resources for AI systems",
            "summary": "Document the resources the AI system depends on: data, tooling, compute, human competence and model provenance.",
            "applies": {}
          },
          {
            "id": "ISO42001-A.5",
            "ref": "Annex A.5",
            "title": "Assessing impacts of AI systems",
            "summary": "A defined process for AI system impact assessment, including impacts on individuals and societies, and its documentation.",
            "applies": {}
          },
          {
            "id": "ISO42001-A.6",
            "ref": "Annex A.6",
            "title": "AI system lifecycle",
            "summary": "Objectives, requirements, design, verification, validation, deployment, operation and monitoring defined and documented for each system.",
            "applies": {}
          },
          {
            "id": "ISO42001-A.7",
            "ref": "Annex A.7",
            "title": "Data for AI systems",
            "summary": "Data provenance, quality, preparation and governance controls for data used in AI systems.",
            "applies": {}
          },
          {
            "id": "ISO42001-A.8",
            "ref": "Annex A.8",
            "title": "Information for interested parties",
            "summary": "Provide the information needed by users and affected parties, including intended use, limitations and how to raise concerns.",
            "applies": {}
          },
          {
            "id": "ISO42001-A.9",
            "ref": "Annex A.9",
            "title": "Use of AI systems",
            "summary": "Responsible use processes, including intended use boundaries and human oversight in operation.",
            "applies": {}
          },
          {
            "id": "ISO42001-A.10",
            "ref": "Annex A.10",
            "title": "Third-party and customer relationships",
            "summary": "Allocate and manage responsibilities across suppliers, model providers and customers in the AI value chain.",
            "applies": {
              "conditions": [
                "third_party_model"
              ]
            }
          }
        ]
      },
      {
        "id": "NIST",
        "name": "NIST AI RMF",
        "citation": "NIST AI Risk Management Framework 1.0 (AI 100-1), January 2023",
        "url": "https://www.nist.gov/itl/ai-risk-management-framework",
        "kind": "voluntary_framework",
        "requirements": [
          {
            "id": "NIST-GOVERN-1.1",
            "ref": "GOVERN 1.1",
            "title": "Legal and regulatory requirements understood",
            "summary": "Legal and regulatory requirements involving AI are understood, managed and documented.",
            "applies": {}
          },
          {
            "id": "NIST-GOVERN-2.1",
            "ref": "GOVERN 2.1",
            "title": "Roles and accountability",
            "summary": "Roles, responsibilities and lines of communication for AI risk are documented and clear to those involved.",
            "applies": {}
          },
          {
            "id": "NIST-GOVERN-4.1",
            "ref": "GOVERN 4.1",
            "title": "Risk culture and critical thinking",
            "summary": "Organisational practices are in place that enable critical thinking and a safety-first mindset in AI design and deployment.",
            "applies": {}
          },
          {
            "id": "NIST-GOVERN-6.1",
            "ref": "GOVERN 6.1",
            "title": "Third-party risk",
            "summary": "Policies address AI risks arising from third-party software, data and models.",
            "applies": {
              "conditions": [
                "third_party_model"
              ]
            }
          },
          {
            "id": "NIST-MAP-1.1",
            "ref": "MAP 1.1",
            "title": "Context established",
            "summary": "Intended purpose, setting, deployment context and expected users are understood and documented.",
            "applies": {}
          },
          {
            "id": "NIST-MAP-2.3",
            "ref": "MAP 2.3",
            "title": "Scientific integrity and TEVV",
            "summary": "Test, evaluation, verification and validation are documented and mapped to the intended purpose.",
            "applies": {}
          },
          {
            "id": "NIST-MAP-5.1",
            "ref": "MAP 5.1",
            "title": "Impacts on individuals and society",
            "summary": "Likelihood and magnitude of impacts on individuals, groups, communities and society are assessed.",
            "applies": {}
          },
          {
            "id": "NIST-MEASURE-2.3",
            "ref": "MEASURE 2.3",
            "title": "Performance demonstrated",
            "summary": "AI system performance and assurance criteria are measured and demonstrated in conditions similar to deployment.",
            "applies": {}
          },
          {
            "id": "NIST-MEASURE-2.7",
            "ref": "MEASURE 2.7",
            "title": "Security and resilience evaluated",
            "summary": "Security and resilience of the AI system are evaluated and documented, including adversarial testing.",
            "applies": {}
          },
          {
            "id": "NIST-MEASURE-2.11",
            "ref": "MEASURE 2.11",
            "title": "Fairness and bias evaluated",
            "summary": "Fairness and bias are evaluated and results documented, including for subgroups.",
            "applies": {}
          },
          {
            "id": "NIST-MEASURE-3.1",
            "ref": "MEASURE 3.1",
            "title": "Risk tracking mechanisms",
            "summary": "Approaches for tracking identified and emergent AI risks over time are in place.",
            "applies": {}
          },
          {
            "id": "NIST-MANAGE-2.2",
            "ref": "MANAGE 2.2",
            "title": "Mechanisms to sustain value",
            "summary": "Mechanisms are in place to supersede, disengage or deactivate systems that demonstrate unintended behaviour.",
            "applies": {}
          },
          {
            "id": "NIST-MANAGE-4.1",
            "ref": "MANAGE 4.1",
            "title": "Post-deployment monitoring plan",
            "summary": "Post-deployment monitoring plans are implemented, including capture and response to incidents and user feedback.",
            "applies": {}
          },
          {
            "id": "NIST-MANAGE-4.3",
            "ref": "MANAGE 4.3",
            "title": "Incident communication",
            "summary": "Incidents and errors are communicated to relevant AI actors, affected communities and authorities.",
            "applies": {}
          }
        ]
      }
    ],
    "controls": [
      {
        "id": "C-01",
        "name": "AI system inventory and registration",
        "type": "preventive",
        "owner": "AI Governance",
        "objective": "Every AI system in use is registered with an accountable owner, purpose, model provenance and lifecycle stage before it goes live.",
        "satisfies": [
          "EUAIA-49",
          "GDPR-30",
          "ISO42001-A.3",
          "NIST-MAP-1.1"
        ],
        "evidence": [
          {
            "id": "E-01a",
            "name": "Inventory record with named owner",
            "kind": "record"
          },
          {
            "id": "E-01b",
            "name": "Intake and approval workflow",
            "kind": "procedure"
          },
          {
            "id": "E-01c",
            "name": "EU database registration reference",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-02",
        "name": "AI policy and governance mandate",
        "type": "preventive",
        "owner": "AI Governance",
        "objective": "An approved AI policy, a standing governance forum and documented decision rights for AI risk acceptance.",
        "satisfies": [
          "ISO42001-5.2",
          "ISO42001-A.2",
          "NIST-GOVERN-2.1"
        ],
        "evidence": [
          {
            "id": "E-02a",
            "name": "Board-approved AI policy",
            "kind": "policy"
          },
          {
            "id": "E-02b",
            "name": "Governance forum terms of reference and minutes",
            "kind": "record"
          },
          {
            "id": "E-02c",
            "name": "RACI for AI risk decisions",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-03",
        "name": "Prohibited-practice screening",
        "type": "preventive",
        "owner": "Legal",
        "objective": "Each system is screened against the Article 5 prohibitions before build and again after any material change of purpose.",
        "satisfies": [
          "EUAIA-5",
          "NIST-GOVERN-1.1"
        ],
        "evidence": [
          {
            "id": "E-03a",
            "name": "Completed Article 5 screening",
            "kind": "assessment"
          },
          {
            "id": "E-03b",
            "name": "Legal sign-off",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-04",
        "name": "Risk classification and derogation assessment",
        "type": "preventive",
        "owner": "AI Governance",
        "objective": "The regulatory tier of each system is determined, evidenced and re-checked on change; any Annex III derogation is documented.",
        "satisfies": [
          "EUAIA-6",
          "NIST-GOVERN-1.1"
        ],
        "evidence": [
          {
            "id": "E-04a",
            "name": "Classification assessment with reasoning",
            "kind": "assessment"
          },
          {
            "id": "E-04b",
            "name": "Derogation assessment where claimed",
            "kind": "assessment"
          },
          {
            "id": "E-04c",
            "name": "Re-classification trigger log",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-05",
        "name": "AI risk management system",
        "type": "preventive",
        "owner": "Risk",
        "objective": "A continuous, documented risk management cycle per system: identify, evaluate, mitigate, test the mitigation, repeat.",
        "satisfies": [
          "EUAIA-9",
          "ISO42001-A.6",
          "NIST-MEASURE-3.1"
        ],
        "evidence": [
          {
            "id": "E-05a",
            "name": "Per-system risk register",
            "kind": "record"
          },
          {
            "id": "E-05b",
            "name": "Risk management procedure",
            "kind": "procedure"
          },
          {
            "id": "E-05c",
            "name": "Mitigation effectiveness test results",
            "kind": "test_report"
          },
          {
            "id": "E-05d",
            "name": "Residual risk acceptance",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-06",
        "name": "AI impact assessment (fundamental rights)",
        "type": "preventive",
        "owner": "AI Governance",
        "objective": "Impacts on individuals, groups and society are assessed before first use, with mitigations and a named accountable owner.",
        "satisfies": [
          "EUAIA-27",
          "ISO42001-6.1.4",
          "ISO42001-A.5",
          "NIST-MAP-5.1"
        ],
        "evidence": [
          {
            "id": "E-06a",
            "name": "Completed impact assessment",
            "kind": "assessment"
          },
          {
            "id": "E-06b",
            "name": "Affected-group analysis",
            "kind": "assessment"
          },
          {
            "id": "E-06c",
            "name": "Mitigation plan with owners",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-07",
        "name": "Data protection impact assessment",
        "type": "preventive",
        "owner": "Privacy",
        "objective": "A DPIA is completed and signed off where the processing meets a high-risk trigger, with design measures recorded.",
        "satisfies": [
          "GDPR-35",
          "GDPR-25",
          "NIST-MAP-5.1"
        ],
        "evidence": [
          {
            "id": "E-07a",
            "name": "Completed DPIA",
            "kind": "assessment"
          },
          {
            "id": "E-07b",
            "name": "DPO opinion",
            "kind": "record"
          },
          {
            "id": "E-07c",
            "name": "Privacy-by-design measures",
            "kind": "artefact"
          }
        ]
      },
      {
        "id": "C-08",
        "name": "Lawful basis and purpose register",
        "type": "preventive",
        "owner": "Privacy",
        "objective": "Every processing purpose has a recorded lawful basis, and the record of processing reflects the live system.",
        "satisfies": [
          "GDPR-6",
          "GDPR-5",
          "GDPR-30"
        ],
        "evidence": [
          {
            "id": "E-08a",
            "name": "Lawful basis determination",
            "kind": "record"
          },
          {
            "id": "E-08b",
            "name": "Legitimate interests balancing test",
            "kind": "assessment"
          },
          {
            "id": "E-08c",
            "name": "Record of processing entry",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-09",
        "name": "Special category and biometric authorisation",
        "type": "preventive",
        "owner": "Privacy",
        "objective": "Special category or biometric processing is authorised under a specific condition, with an additional necessity test.",
        "satisfies": [
          "GDPR-9"
        ],
        "evidence": [
          {
            "id": "E-09a",
            "name": "Article 9 condition determination",
            "kind": "record"
          },
          {
            "id": "E-09b",
            "name": "Necessity and proportionality test",
            "kind": "assessment"
          }
        ]
      },
      {
        "id": "C-10",
        "name": "Training data governance and provenance",
        "type": "preventive",
        "owner": "Data",
        "objective": "Datasets used for training, validation and testing are documented: source, licence, preparation, representativeness and known gaps.",
        "satisfies": [
          "EUAIA-10",
          "ISO42001-A.7",
          "ISO42001-A.4"
        ],
        "evidence": [
          {
            "id": "E-10a",
            "name": "Dataset documentation or data sheet",
            "kind": "record"
          },
          {
            "id": "E-10b",
            "name": "Provenance and licence evidence",
            "kind": "record"
          },
          {
            "id": "E-10c",
            "name": "Data quality checks",
            "kind": "test_report"
          }
        ]
      },
      {
        "id": "C-11",
        "name": "Bias examination and fairness evaluation",
        "type": "detective",
        "owner": "Data Science",
        "objective": "Bias is examined before release and re-measured on a schedule, with subgroup results and a documented mitigation decision.",
        "satisfies": [
          "EUAIA-10",
          "NIST-MEASURE-2.11"
        ],
        "evidence": [
          {
            "id": "E-11a",
            "name": "Bias evaluation report with subgroup metrics",
            "kind": "test_report"
          },
          {
            "id": "E-11b",
            "name": "Mitigation decision record",
            "kind": "record"
          },
          {
            "id": "E-11c",
            "name": "Re-measurement schedule",
            "kind": "procedure"
          }
        ]
      },
      {
        "id": "C-12",
        "name": "Technical documentation pack",
        "type": "preventive",
        "owner": "Engineering",
        "objective": "Annex IV style technical documentation exists, is version-controlled and is kept current with the deployed system.",
        "satisfies": [
          "EUAIA-11",
          "NIST-MAP-2.3"
        ],
        "evidence": [
          {
            "id": "E-12a",
            "name": "Technical documentation pack",
            "kind": "record"
          },
          {
            "id": "E-12b",
            "name": "Version history tied to releases",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-13",
        "name": "Model card and instructions for use",
        "type": "preventive",
        "owner": "Product",
        "objective": "Deployers and operators receive capabilities, limitations, accuracy metrics, foreseeable misuse and oversight measures in writing.",
        "satisfies": [
          "EUAIA-13",
          "ISO42001-A.8"
        ],
        "evidence": [
          {
            "id": "E-13a",
            "name": "Model card",
            "kind": "record"
          },
          {
            "id": "E-13b",
            "name": "Instructions for use",
            "kind": "record"
          },
          {
            "id": "E-13c",
            "name": "Declared accuracy metrics",
            "kind": "test_report"
          }
        ]
      },
      {
        "id": "C-14",
        "name": "Event logging and traceability",
        "type": "detective",
        "owner": "Engineering",
        "objective": "Inputs, outputs, model version and human decisions are logged so any individual outcome can be reconstructed.",
        "satisfies": [
          "EUAIA-12",
          "GDPR-32",
          "NIST-MEASURE-3.1"
        ],
        "evidence": [
          {
            "id": "E-14a",
            "name": "Logging design and retention configuration",
            "kind": "artefact"
          },
          {
            "id": "E-14b",
            "name": "Sample reconstructed decision trail",
            "kind": "record"
          },
          {
            "id": "E-14c",
            "name": "Log integrity and access controls",
            "kind": "artefact"
          }
        ]
      },
      {
        "id": "C-15",
        "name": "Human oversight design and override",
        "type": "preventive",
        "owner": "Operations",
        "objective": "A competent human can interpret the output, decide not to act on it, override it and stop the system, and that path is tested.",
        "satisfies": [
          "EUAIA-14",
          "GDPR-22",
          "ISO42001-A.9",
          "NIST-MANAGE-2.2"
        ],
        "evidence": [
          {
            "id": "E-15a",
            "name": "Human oversight design description",
            "kind": "artefact"
          },
          {
            "id": "E-15b",
            "name": "Escalation and override procedure",
            "kind": "procedure"
          },
          {
            "id": "E-15c",
            "name": "Kill-switch or rollback test",
            "kind": "test_report"
          },
          {
            "id": "E-15d",
            "name": "Override usage records",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-16",
        "name": "Oversight competence and AI literacy",
        "type": "preventive",
        "owner": "HR",
        "objective": "The people operating and overseeing the system are trained on its limits, its failure modes and their intervention duties.",
        "satisfies": [
          "EUAIA-4",
          "ISO42001-A.3",
          "NIST-GOVERN-4.1"
        ],
        "evidence": [
          {
            "id": "E-16a",
            "name": "Role-based AI literacy curriculum",
            "kind": "training"
          },
          {
            "id": "E-16b",
            "name": "Completion records for named overseers",
            "kind": "training"
          }
        ]
      },
      {
        "id": "C-17",
        "name": "Accuracy and robustness testing",
        "type": "detective",
        "owner": "Data Science",
        "objective": "Performance is measured against declared metrics in deployment-like conditions before release and on a schedule after.",
        "satisfies": [
          "EUAIA-15",
          "NIST-MEASURE-2.3",
          "NIST-MAP-2.3"
        ],
        "evidence": [
          {
            "id": "E-17a",
            "name": "Test, evaluation, verification and validation plan",
            "kind": "procedure"
          },
          {
            "id": "E-17b",
            "name": "Pre-release performance report",
            "kind": "test_report"
          },
          {
            "id": "E-17c",
            "name": "Drift and degradation monitoring",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-18",
        "name": "Adversarial testing and AI security",
        "type": "detective",
        "owner": "Security",
        "objective": "The system is tested against adversarial input, prompt injection, data poisoning and model extraction, and findings are tracked to closure.",
        "satisfies": [
          "EUAIA-15",
          "GDPR-32",
          "NIST-MEASURE-2.7"
        ],
        "evidence": [
          {
            "id": "E-18a",
            "name": "Red-team or adversarial test report",
            "kind": "test_report"
          },
          {
            "id": "E-18b",
            "name": "Finding remediation tracker",
            "kind": "record"
          },
          {
            "id": "E-18c",
            "name": "Input and output guardrail configuration",
            "kind": "artefact"
          }
        ]
      },
      {
        "id": "C-19",
        "name": "Transparency notice and AI disclosure",
        "type": "preventive",
        "owner": "Product",
        "objective": "People are told they are dealing with an AI system, what it does with their data and how to reach a human.",
        "satisfies": [
          "EUAIA-50",
          "GDPR-13",
          "ISO42001-A.8"
        ],
        "evidence": [
          {
            "id": "E-19a",
            "name": "User-facing AI disclosure",
            "kind": "artefact"
          },
          {
            "id": "E-19b",
            "name": "Privacy notice covering the AI processing",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-20",
        "name": "Synthetic content marking",
        "type": "preventive",
        "owner": "Engineering",
        "objective": "AI-generated or manipulated output carries machine-readable marking and a human-visible label where required.",
        "satisfies": [
          "EUAIA-50"
        ],
        "evidence": [
          {
            "id": "E-20a",
            "name": "Watermarking or provenance metadata configuration",
            "kind": "artefact"
          },
          {
            "id": "E-20b",
            "name": "Marking verification test",
            "kind": "test_report"
          }
        ]
      },
      {
        "id": "C-21",
        "name": "Explanation and contestation route",
        "type": "corrective",
        "owner": "Operations",
        "objective": "An affected person can get a meaningful explanation of the AI system's role in a decision and contest it to a human.",
        "satisfies": [
          "EUAIA-86",
          "GDPR-22",
          "GDPR-15"
        ],
        "evidence": [
          {
            "id": "E-21a",
            "name": "Explanation template and worked example",
            "kind": "record"
          },
          {
            "id": "E-21b",
            "name": "Contestation and human review procedure",
            "kind": "procedure"
          },
          {
            "id": "E-21c",
            "name": "Case handling records with outcomes",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-22",
        "name": "Quality management system",
        "type": "preventive",
        "owner": "Quality",
        "objective": "A documented QMS ties regulatory strategy, design controls, data management, testing and post-market activity together with accountability.",
        "satisfies": [
          "EUAIA-17",
          "ISO42001-5.2"
        ],
        "evidence": [
          {
            "id": "E-22a",
            "name": "QMS documentation",
            "kind": "policy"
          },
          {
            "id": "E-22b",
            "name": "Internal audit report",
            "kind": "assessment"
          },
          {
            "id": "E-22c",
            "name": "Management review record",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-23",
        "name": "Conformity assessment and declaration",
        "type": "preventive",
        "owner": "Quality",
        "objective": "The applicable conformity assessment route is completed before market placement and repeated after substantial modification.",
        "satisfies": [
          "EUAIA-43"
        ],
        "evidence": [
          {
            "id": "E-23a",
            "name": "Conformity assessment record",
            "kind": "assessment"
          },
          {
            "id": "E-23b",
            "name": "EU declaration of conformity",
            "kind": "record"
          },
          {
            "id": "E-23c",
            "name": "Substantial modification review",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-24",
        "name": "Post-market monitoring",
        "type": "detective",
        "owner": "Operations",
        "objective": "A monitoring plan actively collects performance, complaint and misuse data in production and feeds it back into the risk register.",
        "satisfies": [
          "EUAIA-72",
          "NIST-MANAGE-4.1"
        ],
        "evidence": [
          {
            "id": "E-24a",
            "name": "Post-market monitoring plan",
            "kind": "procedure"
          },
          {
            "id": "E-24b",
            "name": "Monitoring output reviewed by the owner",
            "kind": "record"
          },
          {
            "id": "E-24c",
            "name": "Feedback loop into the risk register",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-25",
        "name": "AI incident response and reporting",
        "type": "corrective",
        "owner": "AI Governance",
        "objective": "AI incidents are detected, triaged against the reporting thresholds, escalated on the clock and closed with a root cause.",
        "satisfies": [
          "EUAIA-73",
          "NIST-MANAGE-4.3",
          "NIST-MANAGE-4.1"
        ],
        "evidence": [
          {
            "id": "E-25a",
            "name": "AI incident response procedure with reporting deadlines",
            "kind": "procedure"
          },
          {
            "id": "E-25b",
            "name": "Incident register",
            "kind": "record"
          },
          {
            "id": "E-25c",
            "name": "Post-incident review with root cause",
            "kind": "record"
          },
          {
            "id": "E-25d",
            "name": "Authority notification record where required",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-26",
        "name": "Third-party model and supplier due diligence",
        "type": "preventive",
        "owner": "Procurement",
        "objective": "Model and data suppliers are assessed and contractually bound to the obligations the organisation has to pass down.",
        "satisfies": [
          "ISO42001-A.10",
          "NIST-GOVERN-6.1"
        ],
        "evidence": [
          {
            "id": "E-26a",
            "name": "Supplier AI due diligence assessment",
            "kind": "assessment"
          },
          {
            "id": "E-26b",
            "name": "Contract clauses on AI obligations",
            "kind": "contract"
          },
          {
            "id": "E-26c",
            "name": "Provider documentation received",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-27",
        "name": "Deployer operating controls",
        "type": "preventive",
        "owner": "Operations",
        "objective": "The system is used within its instructions, input data is relevant and representative, and affected workers are informed before deployment.",
        "satisfies": [
          "EUAIA-26"
        ],
        "evidence": [
          {
            "id": "E-27a",
            "name": "Operating procedure aligned to instructions for use",
            "kind": "procedure"
          },
          {
            "id": "E-27b",
            "name": "Input data suitability check",
            "kind": "record"
          },
          {
            "id": "E-27c",
            "name": "Worker and works council notification",
            "kind": "record"
          }
        ]
      },
      {
        "id": "C-28",
        "name": "International transfer safeguards",
        "type": "preventive",
        "owner": "Privacy",
        "objective": "Personal data leaving the EEA, including to model inference endpoints, is covered by a transfer mechanism and a risk assessment.",
        "satisfies": [
          "GDPR-44"
        ],
        "evidence": [
          {
            "id": "E-28a",
            "name": "Transfer mechanism in place",
            "kind": "contract"
          },
          {
            "id": "E-28b",
            "name": "Transfer risk assessment",
            "kind": "assessment"
          },
          {
            "id": "E-28c",
            "name": "Inference and hosting data flow map",
            "kind": "artefact"
          }
        ]
      },
      {
        "id": "C-29",
        "name": "GPAI documentation and copyright policy",
        "type": "preventive",
        "owner": "Legal",
        "objective": "Where the organisation provides a general-purpose model, model documentation, a training-content summary and a copyright policy are maintained.",
        "satisfies": [
          "EUAIA-53"
        ],
        "evidence": [
          {
            "id": "E-29a",
            "name": "GPAI model documentation",
            "kind": "record"
          },
          {
            "id": "E-29b",
            "name": "Public training-content summary",
            "kind": "record"
          },
          {
            "id": "E-29c",
            "name": "Copyright and text-and-data-mining policy",
            "kind": "policy"
          }
        ]
      }
    ],
    "dora": {
      "meta": {
        "framework": "Digital Operational Resilience Act (DORA)",
        "citation": "Regulation (EU) 2022/2554",
        "version": "1.0.0",
        "updated": "2026-09-10",
        "source": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2554",
        "requirement_count": 19,
        "scope_note": "Covers Chapters II-VI: the obligations a financial entity (or an ICT provider assessing its own readiness to serve one) applies to itself. Chapter V Section II (oversight of critical ICT third-party providers) is a duty of the European Supervisory Authorities, not of financial entities, and is out of scope. Chapters VII-IX (competent authorities, delegated acts, transitional provisions) are institutional/administrative, not self-assessable controls, and are also out of scope.",
        "chapters": [
          {
            "id": "II",
            "title": "ICT risk management"
          },
          {
            "id": "III",
            "title": "ICT-related incident management, classification and reporting"
          },
          {
            "id": "IV",
            "title": "Digital operational resilience testing"
          },
          {
            "id": "V",
            "title": "Managing of ICT third-party risk (Section I - key principles)"
          },
          {
            "id": "VI",
            "title": "Information-sharing arrangements"
          }
        ]
      },
      "requirements": [
        {
          "id": "DORA-05",
          "chapter": "II",
          "article": "Art. 5",
          "article_title": "Governance and organisation",
          "requirement": "The management body approves, owns and is accountable for the ICT risk management framework - this cannot be delegated away to an IT function without oversight.",
          "evidence_examples": [
            "Management body meeting minutes approving the ICT risk framework",
            "A named accountable owner for ICT risk at management-body level"
          ]
        },
        {
          "id": "DORA-06",
          "chapter": "II",
          "article": "Art. 6",
          "article_title": "ICT risk management framework",
          "requirement": "A documented, board-approved ICT risk management framework exists, covering strategies, policies, procedures, protocols and tools, and is reviewed at least once a year.",
          "evidence_examples": [
            "ICT risk management framework document with a review date within 12 months",
            "Version history showing annual review"
          ]
        },
        {
          "id": "DORA-08",
          "chapter": "II",
          "article": "Art. 8",
          "article_title": "Identification",
          "requirement": "ICT assets, systems, processes and dependencies - including on ICT third-party providers - are identified, classified and documented, with risk reassessed at least yearly.",
          "evidence_examples": [
            "ICT asset inventory with classification",
            "Dependency map covering third-party services"
          ]
        },
        {
          "id": "DORA-09",
          "chapter": "II",
          "article": "Art. 9",
          "article_title": "Protection and prevention",
          "requirement": "Security policies, procedures and tools are in continuous use to protect ICT systems - network security, patching, encryption and least-privilege access among them.",
          "evidence_examples": [
            "Patch management policy and recent patch cadence records",
            "Access control policy with least-privilege reviews"
          ]
        },
        {
          "id": "DORA-10",
          "chapter": "II",
          "article": "Art. 10",
          "article_title": "Detection",
          "requirement": "Mechanisms exist to promptly detect anomalous activity and ICT-related incidents, with multiple layers of control and automated alerting where appropriate.",
          "evidence_examples": [
            "SIEM or monitoring tool configuration and alert logs",
            "Documented detection thresholds"
          ]
        },
        {
          "id": "DORA-11",
          "chapter": "II",
          "article": "Art. 11",
          "article_title": "Response and recovery",
          "requirement": "A dedicated ICT business continuity policy and response/recovery plans exist, are tested, and prioritise the continuity of critical or important functions.",
          "evidence_examples": [
            "ICT business continuity policy",
            "Most recent recovery-plan test report"
          ]
        },
        {
          "id": "DORA-12",
          "chapter": "II",
          "article": "Art. 12",
          "article_title": "Backup policies and procedures, restoration and recovery procedures and methods",
          "requirement": "Backup policies and restoration/recovery procedures are documented and tested periodically, with backups kept logically and physically separate from source systems.",
          "evidence_examples": [
            "Backup policy stating frequency and retention",
            "Restoration test log"
          ]
        },
        {
          "id": "DORA-13",
          "chapter": "II",
          "article": "Art. 13",
          "article_title": "Learning and evolving",
          "requirement": "Post-incident reviews and root-cause analysis feed back into the ICT risk management framework, and staff receive ICT-risk awareness training.",
          "evidence_examples": [
            "Post-incident review reports with action items closed out",
            "Staff training completion records"
          ]
        },
        {
          "id": "DORA-14",
          "chapter": "II",
          "article": "Art. 14",
          "article_title": "Communication",
          "requirement": "Crisis communication plans cover ICT-related incidents, addressing both internal stakeholders and external parties such as clients and counterparties where relevant.",
          "evidence_examples": [
            "Crisis communication plan naming spokespeople and channels",
            "A drill or real incident where the plan was used"
          ]
        },
        {
          "id": "DORA-17",
          "chapter": "III",
          "article": "Art. 17",
          "article_title": "ICT-related incident management process",
          "requirement": "A documented process exists to detect, manage, log, classify, prioritise and respond to ICT-related incidents.",
          "evidence_examples": [
            "Incident management process document",
            "Incident log/ticketing history"
          ]
        },
        {
          "id": "DORA-18",
          "chapter": "III",
          "article": "Art. 18",
          "article_title": "Classification of ICT-related incidents and cyber threats",
          "requirement": "Defined criteria and thresholds exist to classify an incident as 'major' (or a threat as 'significant'), rather than leaving materiality to ad-hoc judgement.",
          "evidence_examples": [
            "Written classification criteria with thresholds",
            "Example of an incident classified against those criteria"
          ]
        },
        {
          "id": "DORA-19",
          "chapter": "III",
          "article": "Art. 19",
          "article_title": "Reporting of major ICT-related incidents and voluntary notification of significant cyber threats",
          "requirement": "Major ICT-related incidents are reported to the competent authority as initial, intermediate and final reports within the required timelines.",
          "evidence_examples": [
            "Template for initial/intermediate/final incident reports",
            "A completed report from a past incident, or a documented process if none has occurred"
          ]
        },
        {
          "id": "DORA-24",
          "chapter": "IV",
          "article": "Art. 24",
          "article_title": "General requirements for the performance of digital operational resilience testing",
          "requirement": "A risk-based digital operational resilience testing programme exists, covers all ICT systems supporting critical or important functions, and runs at least annually.",
          "evidence_examples": [
            "Testing programme document with an annual schedule",
            "Coverage list of critical systems tested"
          ]
        },
        {
          "id": "DORA-25",
          "chapter": "IV",
          "article": "Art. 25",
          "article_title": "Testing of ICT tools and systems",
          "requirement": "A defined set of tests is run and is appropriate to the entity's size and risk profile - for example vulnerability assessments, scenario-based tests, source-code review or penetration testing.",
          "evidence_examples": [
            "Most recent vulnerability assessment or penetration test report",
            "Remediation tracking for findings"
          ]
        },
        {
          "id": "DORA-26",
          "chapter": "IV",
          "article": "Art. 26",
          "article_title": "Advanced testing of ICT tools, systems and processes based on TLPT",
          "requirement": "Entities identified as subject to advanced testing run threat-led penetration testing (TLPT) at least every three years, using authorised or certified testers.",
          "evidence_examples": [
            "TLPT scope and authorisation record",
            "Most recent TLPT report and remediation plan"
          ]
        },
        {
          "id": "DORA-28",
          "chapter": "V",
          "article": "Art. 28",
          "article_title": "General principles",
          "requirement": "ICT third-party risk is managed as an integral part of the ICT risk management framework, with a register of all contractual arrangements and a defined strategy for functions supported by critical or important providers.",
          "evidence_examples": [
            "Register of ICT third-party contractual arrangements",
            "ICT third-party risk strategy document"
          ]
        },
        {
          "id": "DORA-29",
          "chapter": "V",
          "article": "Art. 29",
          "article_title": "Preliminary assessment of ICT concentration risk at entity level",
          "requirement": "Before contracting, the entity assesses concentration risk - reliance on a single provider or a small number of providers - and the criticality of the function being outsourced.",
          "evidence_examples": [
            "Pre-contract concentration-risk assessment for a current critical vendor",
            "Vendor criticality tiering methodology"
          ]
        },
        {
          "id": "DORA-30",
          "chapter": "V",
          "article": "Art. 30",
          "article_title": "Key contractual provisions",
          "requirement": "Contracts with ICT third-party providers include service-level descriptions and performance targets, notice periods, audit and access rights, exit strategies, and cooperation duties during ICT incidents.",
          "evidence_examples": [
            "A current critical-vendor contract with these clauses highlighted",
            "Exit-strategy/transition-plan document for a critical provider"
          ]
        },
        {
          "id": "DORA-45",
          "chapter": "VI",
          "article": "Art. 45",
          "article_title": "Information-sharing arrangements on cyber threat information and intelligence",
          "requirement": "The entity participates in, or has assessed and decided against, voluntary arrangements to exchange cyber threat information and intelligence with other financial entities.",
          "evidence_examples": [
            "Membership record in an information-sharing community (e.g. an ISAC)",
            "A documented decision not to participate, with the reasoning"
          ]
        }
      ]
    },
    "source_ids": [
      "ai-governance-control-room:docs/frameworks.json",
      "ai-governance-control-room:docs/controls.json",
      "dora-compliance-scanner:docs/requirements.json"
    ],
    "interpretation": "Authored paraphrases and internal control mappings. Legal applicability and control effectiveness are unassessed."
  },
  "limits": [
    "Committed snapshots; no live incidents or trend time series.",
    "Authored severity is not empirical frequency, loss or probability.",
    "Governance catalogue references do not establish applicable law or implemented control coverage."
  ]
};
