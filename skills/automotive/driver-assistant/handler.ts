/**
 * driver-assistant — 47Plate AI Driver Assistant & Legal Shield
 *
 * Actions:
 *   warning_light     — Dashboard warning light photo diagnosis
 *   ticket_appeal     — Romanian traffic ticket appeal (contestație) generation
 *   stas_1848_check   — Road sign compliance verification (STAS 1848)
 *   obd_diagnose      — OBD-II trouble code interpretation
 *   ocr_receipt       — Receipt/invoice OCR → structured data
 *   legal_nullity_audit — Procedural nullity audit of proces-verbal
 *   capabilities      — List all driver-assistant capabilities
 */

interface Vehicle {
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
}

interface Ticket {
  ticket_number?: string;
  date?: string;
  location?: string;
  offense?: string;
  fine_amount?: number;
  officer_badge?: string;
  speed_alleged?: number;
  speed_limit?: number;
  device_type?: string;
  device_serial?: string;
}

export default async function handler(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const vehicle = (input.vehicle as Vehicle) || {};
  const locale = (input.locale as string) || 'ro-RO';

  switch (action) {
    /* ─── Warning Light Diagnosis ─────────────────────────────── */
    case 'warning_light': {
      const imageUrl = input.image_url as string | undefined;
      const vehicleCtx = formatVehicle(vehicle);
      return {
        result: {
          action: 'warning_light',
          requires_vision: true,
          prompt_context: {
            role: 'automotive_diagnostic_expert',
            task: 'Analyze the dashboard warning light in the provided image.',
            vehicle: vehicleCtx,
            locale,
            image_url: imageUrl || null,
            response_format: {
              symbol_name: 'string — official name of the warning light',
              color: 'string — red/amber/green/blue/white',
              severity: 'critical | warning | informational',
              safe_to_drive: 'boolean',
              explanation: 'string — plain-language explanation in target locale',
              possible_causes: 'string[] — ranked by likelihood for this vehicle',
              recommended_action: 'string — immediate next step',
              estimated_cost_range: '{ min: number, max: number, currency: "RON" }',
              urgency: 'stop_immediately | schedule_service | monitor | informational',
            },
          },
          instructions: [
            '1. Identify the warning light symbol from the photo.',
            `2. Cross-reference with ${vehicleCtx} specific warning light database.`,
            '3. Classify severity: RED = critical (stop driving), AMBER = warning (schedule service), GREEN/BLUE/WHITE = informational.',
            '4. Explain in simple terms what the light means for this specific vehicle.',
            '5. List most probable causes ranked by frequency for this make/model/year.',
            '6. Provide estimated repair cost range in RON (Romanian market rates).',
            '7. State clearly whether it is safe to continue driving.',
          ],
        },
      };
    }

    /* ─── Ticket Appeal (Contestație) ─────────────────────────── */
    case 'ticket_appeal': {
      const ticket = (input.ticket as Ticket) || {};
      const dashcamUrls = (input.dashcam_urls as string[]) || [];
      return {
        result: {
          action: 'ticket_appeal',
          requires_generation: true,
          prompt_context: {
            role: 'romanian_traffic_law_expert',
            task: 'Generate a formal contestație (traffic ticket appeal) document.',
            ticket,
            vehicle: formatVehicle(vehicle),
            dashcam_evidence_count: dashcamUrls.length,
            dashcam_urls: dashcamUrls,
            locale,
            legal_framework: {
              primary: 'OUG 195/2002 privind circulația pe drumurile publice',
              secondary: 'HG 1391/2006 — Regulamentul de aplicare a OUG 195/2002',
              procedural: 'OG 2/2001 privind regimul juridic al contravențiilor',
              signage: 'STAS 1848-1:2011 — Semnalizare rutieră',
            },
            document_structure: {
              header: 'Către Judecătoria [jurisdicție] — Plângere contravențională',
              sections: [
                'I. Date de identificare (petent, proces-verbal)',
                'II. Situația de fapt',
                'III. Motive de nulitate absolută',
                'IV. Motive de nulitate relativă',
                'V. Probe (dashcam, martori, documente)',
                'VI. Verificare STAS 1848 (dacă aplicabil)',
                'VII. Cereri',
                'Anexe: lista probelor cu descriere',
              ],
            },
            nullity_checks: getNullityChecks(),
          },
          instructions: [
            '1. Verify all mandatory fields in the proces-verbal per OG 2/2001 Art. 16-17.',
            '2. Check for absolute nullity grounds (missing mandatory elements).',
            '3. Check for relative nullity grounds (procedural violations).',
            '4. If speed offense: verify metrological certification of device, operator authorization.',
            '5. If dashcam evidence provided: reference timestamps, frame descriptions.',
            '6. If road sign related: include STAS 1848 compliance analysis.',
            '7. Generate formal Romanian legal document with proper structure and citations.',
            '8. Include evidence appendix listing all dashcam clips with descriptions.',
          ],
        },
      };
    }

    /* ─── STAS 1848 Road Sign Compliance ──────────────────────── */
    case 'stas_1848_check': {
      const imageUrl = input.image_url as string | undefined;
      return {
        result: {
          action: 'stas_1848_check',
          requires_vision: true,
          prompt_context: {
            role: 'road_signage_compliance_expert',
            task: 'Verify road sign compliance with STAS 1848-1:2011.',
            image_url: imageUrl || null,
            locale,
            standard: 'STAS 1848-1:2011 — Semnalizare rutieră — Partea 1: Indicatoare',
            compliance_checks: [
              { check: 'sign_type_identification', desc: 'Identify sign type and category (avertizare/reglementare/orientare/informare)' },
              { check: 'placement_height', desc: 'Verify mounting height: 2.0-2.5m urban, 1.5-2.0m rural (edge of sign)' },
              { check: 'lateral_offset', desc: 'Min 0.5m from roadway edge, max 2.0m' },
              { check: 'visibility_distance', desc: 'Readable from min 150m (urban 50 km/h), 250m (rural), 300m (highway)' },
              { check: 'retroreflection', desc: 'Class RA2 minimum for regulatory signs, RA1 for informational' },
              { check: 'sign_condition', desc: 'No damage, fading, obstruction, or graffiti reducing legibility' },
              { check: 'mandatory_combinations', desc: 'Speed limit signs require zone entry/exit pair; warning signs require distance plate' },
              { check: 'approach_distance', desc: 'Warning signs placed 150-250m before hazard (urban 50-100m)' },
              { check: 'contradictory_signs', desc: 'No contradictory signs within 100m zone' },
            ],
            response_format: {
              sign_identified: 'string — sign type and meaning',
              compliant: 'boolean',
              violations: '{ check: string, expected: string, observed: string, severity: string }[]',
              appeal_relevance: 'string — how this affects a ticket appeal',
              evidence_quality: 'high | medium | low — suitability as appeal evidence',
              recommendations: 'string[] — next steps for the driver',
            },
          },
          instructions: [
            '1. Identify the road sign(s) in the image.',
            '2. Run all 9 compliance checks against STAS 1848-1:2011.',
            '3. For each violation found, note expected vs observed with severity.',
            '4. Assess whether violations are strong enough for a ticket appeal.',
            '5. Rate evidence quality (photo clarity, angle, metadata).',
            '6. Provide actionable recommendations.',
          ],
        },
      };
    }

    /* ─── OBD-II Diagnostic Trouble Code Interpretation ────────── */
    case 'obd_diagnose': {
      const obdCodes = (input.obd_codes as string[]) || [];
      const vehicleCtx = formatVehicle(vehicle);
      return {
        result: {
          action: 'obd_diagnose',
          prompt_context: {
            role: 'obd_diagnostic_specialist',
            task: 'Interpret OBD-II trouble codes for this vehicle.',
            codes: obdCodes,
            vehicle: vehicleCtx,
            locale,
            code_prefixes: {
              P: 'Powertrain (engine + transmission)',
              C: 'Chassis (ABS, steering, suspension)',
              B: 'Body (airbags, climate, lighting)',
              U: 'Network (CAN bus, modules, communication)',
            },
            response_format_per_code: {
              code: 'string — the DTC',
              system: 'powertrain | chassis | body | network',
              official_description: 'string — SAE J2012 standard description',
              plain_explanation: 'string — simple explanation in target locale',
              severity: 'critical | moderate | minor | informational',
              safe_to_drive: 'boolean',
              possible_causes: '{ cause: string, likelihood: "high" | "medium" | "low" }[]',
              recommended_action: 'string',
              estimated_cost_ron: '{ min: number, max: number }',
              urgency: 'stop_immediately | this_week | this_month | next_service',
              related_codes: 'string[] — commonly co-occurring DTCs',
            },
          },
          instructions: [
            '1. Parse each DTC: prefix (P/C/B/U), first digit (0=generic, 1=manufacturer-specific), remaining digits.',
            `2. Cross-reference with ${vehicleCtx} known issues database.`,
            '3. Explain each code in simple Romanian (or target locale).',
            '4. Classify severity and driving safety impact.',
            '5. If multiple codes present, identify root cause vs symptom codes.',
            '6. Provide Romanian market repair cost estimates in RON.',
            '7. Prioritize by urgency — most critical first.',
          ],
        },
      };
    }

    /* ─── OCR Receipt & Document Extraction ────────────────────── */
    case 'ocr_receipt': {
      const imageUrl = input.image_url as string | undefined;
      return {
        result: {
          action: 'ocr_receipt',
          requires_vision: true,
          prompt_context: {
            role: 'document_ocr_specialist',
            task: 'Extract structured data from mechanic invoice / parts receipt / service document.',
            image_url: imageUrl || null,
            vehicle: formatVehicle(vehicle),
            locale,
            response_format: {
              document_type: 'invoice | receipt | estimate | service_record',
              vendor: '{ name: string, cui: string, address: string }',
              date: 'string — ISO 8601',
              invoice_number: 'string',
              vehicle_identified: '{ vin: string, plate: string, make: string, model: string, year: number, km: number }',
              line_items: '{ description: string, part_number: string | null, quantity: number, unit_price: number, total: number, type: "part" | "labor" | "consumable" | "other" }[]',
              subtotal: 'number',
              vat_rate: 'number — typically 19% in Romania',
              vat_amount: 'number',
              total: 'number',
              currency: 'string — typically RON',
              payment_method: 'cash | card | transfer | null',
              warranty_info: 'string | null',
              next_service: '{ km: number | null, date: string | null } | null',
              confidence: 'number — 0.0 to 1.0 OCR confidence score',
              raw_text: 'string — full OCR text for verification',
            },
          },
          instructions: [
            '1. OCR the full document, preserving structure (tables, columns).',
            '2. Identify document type (invoice, receipt, estimate, service record).',
            '3. Extract vendor details including CUI (fiscal code) if present.',
            '4. Extract vehicle identification (VIN, plate, make/model/year, km).',
            '5. Parse all line items with quantities, unit prices, and totals.',
            '6. Calculate and verify subtotal, VAT (19%), and grand total.',
            '7. Return structured JSON suitable for TCO dashboard ingestion.',
            '8. Include confidence score and raw OCR text for verification.',
          ],
        },
      };
    }

    /* ─── Legal Nullity Audit ─────────────────────────────────── */
    case 'legal_nullity_audit': {
      const ticket = (input.ticket as Ticket) || {};
      return {
        result: {
          action: 'legal_nullity_audit',
          prompt_context: {
            role: 'romanian_contravention_law_specialist',
            task: 'Perform systematic nullity audit of a Romanian traffic proces-verbal.',
            ticket,
            locale,
            legal_basis: {
              og_2_2001: 'OG 2/2001 privind regimul juridic al contravențiilor',
              oug_195_2002: 'OUG 195/2002 privind circulația pe drumurile publice',
              ncpc: 'Noul Cod de Procedură Civilă',
            },
            nullity_checks: getNullityChecks(),
            response_format: {
              absolute_nullities: '{ field: string, article: string, status: "missing" | "present" | "invalid", detail: string }[]',
              relative_nullities: '{ issue: string, article: string, prejudice: string, detail: string }[]',
              procedural_violations: '{ violation: string, legal_basis: string, detail: string }[]',
              device_verification: '{ valid: boolean, issues: string[] } — for speed/alcohol measurement devices',
              notification_compliance: '{ within_deadline: boolean, method: string, issues: string[] }',
              overall_assessment: {
                nullity_grounds_found: 'number',
                strongest_ground: 'string',
                appeal_success_likelihood: 'high | medium | low',
                recommended_strategy: 'string',
              },
            },
          },
          instructions: [
            '1. Check all 15 mandatory fields per OG 2/2001 Art. 16-17.',
            '2. Classify each missing/invalid field as absolute or relative nullity.',
            '3. For relative nullities, articulate the prejudice suffered.',
            '4. Check notification timeline (15 days from date of fact).',
            '5. If speed offense: verify device metrological certification, operator authorization, measurement methodology.',
            '6. If alcohol offense: verify breathalyzer calibration, blood sample chain of custody.',
            '7. Assess overall appeal viability and recommend strategy.',
            '8. Cite specific articles and paragraphs for each finding.',
          ],
        },
      };
    }

    /* ─── Capabilities Listing ────────────────────────────────── */
    case 'capabilities': {
      return {
        result: {
          skill: 'driver-assistant',
          version: '0.1.0',
          product: '47Plate — Vehicle Companion App',
          locale_default: 'ro-RO',
          capabilities: [
            {
              action: 'warning_light',
              name: 'Warning Light Diagnosis',
              description: 'Photo-based dashboard warning light identification with vehicle-specific explanation, severity, cost estimate, and action recommendation.',
              requires: ['image_url'],
              optional: ['vehicle'],
              uses_vision: true,
            },
            {
              action: 'ticket_appeal',
              name: 'Ticket Appeal Generator (Contestație)',
              description: 'Formal Romanian traffic ticket appeal with procedural nullity checks, dashcam evidence references, STAS 1848 analysis, and legal citations.',
              requires: ['ticket'],
              optional: ['dashcam_urls', 'vehicle', 'image_url'],
              uses_vision: false,
            },
            {
              action: 'stas_1848_check',
              name: 'STAS 1848 Road Sign Compliance',
              description: 'Verify road signage compliance with Romanian standard STAS 1848-1:2011 — placement, visibility, retroreflection, mandatory combinations.',
              requires: ['image_url'],
              optional: [],
              uses_vision: true,
            },
            {
              action: 'obd_diagnose',
              name: 'OBD-II Trouble Code Interpreter',
              description: 'Plain-language interpretation of OBD-II DTCs with vehicle-specific causes, severity, repair cost estimates (RON), and urgency classification.',
              requires: ['obd_codes'],
              optional: ['vehicle'],
              uses_vision: false,
            },
            {
              action: 'ocr_receipt',
              name: 'Receipt & Invoice OCR',
              description: 'Extract structured data from mechanic invoices and parts receipts — line items, costs, VIN, vendor CUI — for TCO dashboard.',
              requires: ['image_url'],
              optional: ['vehicle'],
              uses_vision: true,
            },
            {
              action: 'legal_nullity_audit',
              name: 'Legal Nullity Audit',
              description: 'Systematic procedural audit of Romanian traffic fines — 15 mandatory fields, notification timeline, device verification, appeal strategy.',
              requires: ['ticket'],
              optional: [],
              uses_vision: false,
            },
          ],
          integration: {
            endpoint: '/v1/chat/completions',
            auth: 'Bearer sk-sven-<kid>.<secret>',
            model: 'sven-driver-assistant',
            a2a_endpoint: '/v1/a2a',
          },
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Valid actions: warning_light, ticket_appeal, stas_1848_check, obd_diagnose, ocr_receipt, legal_nullity_audit, capabilities` };
  }
}

/* ─── Helpers ──────────────────────────────────────────────────── */

function formatVehicle(v: Vehicle): string {
  const parts = [v.make, v.model, v.year ? String(v.year) : null].filter(Boolean);
  if (parts.length === 0) return 'unknown vehicle';
  const vinSuffix = v.vin ? ` (VIN: ${v.vin})` : '';
  return parts.join(' ') + vinSuffix;
}

function getNullityChecks(): Array<{ field: string; article: string; type: string; description: string }> {
  return [
    { field: 'data_proces_verbal', article: 'OG 2/2001 Art.16(1)', type: 'absolute', description: 'Data întocmirii procesului-verbal' },
    { field: 'nume_prenume_agent', article: 'OG 2/2001 Art.16(1)', type: 'absolute', description: 'Numele, prenumele și calitatea agentului constatator' },
    { field: 'institutia_agent', article: 'OG 2/2001 Art.16(1)', type: 'absolute', description: 'Instituția din care face parte agentul' },
    { field: 'date_contravenient', article: 'OG 2/2001 Art.16(1)', type: 'absolute', description: 'Datele de identificare ale contravenientului (CNP, domiciliu)' },
    { field: 'descriere_fapta', article: 'OG 2/2001 Art.16(1)', type: 'absolute', description: 'Descrierea faptei contravenționale' },
    { field: 'data_ora_fapta', article: 'OG 2/2001 Art.16(1)', type: 'absolute', description: 'Data și ora săvârșirii faptei' },
    { field: 'loc_fapta', article: 'OG 2/2001 Art.16(1)', type: 'absolute', description: 'Locul săvârșirii faptei (adresă exactă, km)' },
    { field: 'act_normativ', article: 'OG 2/2001 Art.16(1)', type: 'absolute', description: 'Actul normativ încălcat (articol, alineat)' },
    { field: 'sanctiune', article: 'OG 2/2001 Art.16(1)', type: 'absolute', description: 'Sancțiunea aplicată și cuantumul amenzii' },
    { field: 'semnatura_agent', article: 'OG 2/2001 Art.16(7)', type: 'absolute', description: 'Semnătura agentului constatator' },
    { field: 'termen_plata', article: 'OG 2/2001 Art.16(1)', type: 'relative', description: 'Termenul de plată (15 zile) și posibilitatea achitării a jumătate (48h)' },
    { field: 'cale_atac', article: 'OG 2/2001 Art.16(1)', type: 'relative', description: 'Calea de atac și termenul de exercitare (15 zile)' },
    { field: 'martor', article: 'OG 2/2001 Art.16(7)', type: 'relative', description: 'Martor sau mențiunea "contravenientul nu a semnat"' },
    { field: 'obiectiuni', article: 'OG 2/2001 Art.16(7)', type: 'relative', description: 'Rubrica obiecțiuni a contravenientului' },
    { field: 'comunicare', article: 'OG 2/2001 Art.25-27', type: 'relative', description: 'Comunicarea PV în termen de 2 luni de la data constatării' },
  ];
}
