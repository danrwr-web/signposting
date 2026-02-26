import 'server-only'
import { prisma } from '@/lib/prisma'

export interface CustomisedInstructionResult {
  briefInstruction: string
  instructionsHtml: string
  instructionsJson?: string
  modelUsed: string
}

interface BaseSymptomData {
  name: string
  ageGroup: string
  briefInstruction: string | null
  instructionsHtml: string | null
}

interface AppointmentArchetypeConfig {
  enabled: boolean
  localName: string
  clinicianRole: string
  description: string
}

interface ClinicianArchetypeConfig {
  key: string
  enabled: boolean
  localName?: string | null
  role?: string | null
  description?: string | null
  restrictions?: string | null
  acceptsUnderFives?: boolean | null
}

interface AppointmentModelConfig {
  routineContinuityGp: AppointmentArchetypeConfig
  routineGpPhone: AppointmentArchetypeConfig
  gpTriage48h: AppointmentArchetypeConfig
  urgentSameDayPhone: AppointmentArchetypeConfig
  urgentSameDayF2F: AppointmentArchetypeConfig
  otherClinicianDirect: AppointmentArchetypeConfig
  clinicianArchetypes?: ClinicianArchetypeConfig[]
}

interface OnboardingProfileJson {
  surgeryName: string | null
  urgentCareModel: {
    hasDutyDoctor: boolean
    dutyDoctorTerm: string | null
    usesRedSlots: boolean
    redSlotName?: string | null
    urgentSlotsDescription: string
  }
  bookingRules: {
    canBookDirectly: string[]
    mustNotBookDirectly: string
  }
  team: {
    roles: string[]
    roleRoutingNotes: string
  }
  escalation: {
    firstEscalation: string | null
    urgentWording: string
  }
  localServices: {
    msk: string
    mentalHealth: string
    socialPrescribing: string
    communityNursing: string
    audiology: string
    frailty: string
    sexualHealth: string
    outOfHours: string
    includeInInstructions: 'yes' | 'brief' | 'no'
  }
  communicationStyle: {
    detailLevel: 'brief' | 'moderate' | 'detailed'
    terminologyPreference: 'surgery' | 'generic' | 'mixed'
  }
  appointmentModel?: AppointmentModelConfig
}

/**
 * Customise symptom instructions using AI based on surgery onboarding profile
 */
export async function customiseInstructions(
  baseSymptom: BaseSymptomData,
  onboardingProfile: OnboardingProfileJson,
  userEmail: string
): Promise<CustomisedInstructionResult> {
  // Get Azure OpenAI configuration
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION

  if (!endpoint || !apiKey || !deployment || !apiVersion) {
    throw new Error('Missing Azure OpenAI configuration')
  }

  const apiUrl = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`

  // Extract appointment model (with defaults for backwards compatibility)
  const appointmentModel = onboardingProfile.appointmentModel || {
    routineContinuityGp: { enabled: false, localName: '', clinicianRole: '', description: '' },
    routineGpPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    gpTriage48h: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayF2F: { enabled: false, localName: '', clinicianRole: '', description: '' },
    otherClinicianDirect: { enabled: false, localName: '', clinicianRole: '', description: '' },
    clinicianArchetypes: [],
  }

  // Check if any archetypes are enabled
  const { clinicianArchetypes: _ca, ...archetypeConfigs } = appointmentModel
  const hasEnabledArchetypes = Object.values(archetypeConfigs).some((arch: any) => arch.enabled)

  // Helper function to find fallback archetype
  const getFallbackArchetype = (preferredKey: keyof AppointmentModelConfig): keyof AppointmentModelConfig | null => {
    if ((appointmentModel[preferredKey] as any)?.enabled) {
      return preferredKey
    }
    // Fallback order based on semantic similarity
    const fallbackMap: Partial<Record<string, string[]>> = {
      routineContinuityGp: ['routineGpPhone', 'gpTriage48h'],
      routineGpPhone: ['routineContinuityGp', 'gpTriage48h'],
      gpTriage48h: ['routineGpPhone', 'urgentSameDayPhone'],
      urgentSameDayPhone: ['urgentSameDayF2F', 'gpTriage48h'],
      urgentSameDayF2F: ['urgentSameDayPhone', 'gpTriage48h'],
      otherClinicianDirect: ['routineContinuityGp'],
    }
    const fallbacks = fallbackMap[preferredKey] || []
    for (const fallback of fallbacks) {
      if ((appointmentModel[fallback as keyof AppointmentModelConfig] as any)?.enabled) {
        return fallback as keyof AppointmentModelConfig
      }
    }
    return null
  }

  // Build appointment model description for enabled archetypes
  let appointmentModelInstruction = ''
  if (hasEnabledArchetypes) {
    const enabledArchetypes: string[] = []
    
    if (appointmentModel.routineContinuityGp.enabled) {
      enabledArchetypes.push(
        `Routine continuity GP: local name "${appointmentModel.routineContinuityGp.localName || 'routine continuity GP'}". ` +
        `Clinician: ${appointmentModel.routineContinuityGp.clinicianRole || 'GP'}. ` +
        `Used for: ${appointmentModel.routineContinuityGp.description || 'routine appointments where continuity is important'}.`
      )
    }
    
    if (appointmentModel.routineGpPhone.enabled) {
      enabledArchetypes.push(
        `Routine GP telephone: local name "${appointmentModel.routineGpPhone.localName || 'routine GP telephone'}". ` +
        `Clinician: ${appointmentModel.routineGpPhone.clinicianRole || 'GP'}. ` +
        `Used for: ${appointmentModel.routineGpPhone.description || 'routine telephone consultations'}.`
      )
    }
    
    if (appointmentModel.gpTriage48h.enabled) {
      enabledArchetypes.push(
        `GP triage within 48 hours: local name "${appointmentModel.gpTriage48h.localName || 'GP triage (48h)'}". ` +
        `Clinician: ${appointmentModel.gpTriage48h.clinicianRole || 'GP'}. ` +
        `Used for: ${appointmentModel.gpTriage48h.description || 'issues needing GP input within 48 hours but not same-day emergencies'}.`
      )
    }
    
    if (appointmentModel.urgentSameDayPhone.enabled) {
      enabledArchetypes.push(
        `Urgent same-day telephone (Duty GP): local name "${appointmentModel.urgentSameDayPhone.localName || 'urgent same-day telephone'}". ` +
        `Clinician: ${appointmentModel.urgentSameDayPhone.clinicianRole || 'Duty GP'}. ` +
        `Used for: ${appointmentModel.urgentSameDayPhone.description || 'urgent same-day telephone consultations'}.`
      )
    }
    
    if (appointmentModel.urgentSameDayF2F.enabled) {
      enabledArchetypes.push(
        `Urgent same-day face-to-face: local name "${appointmentModel.urgentSameDayF2F.localName || 'urgent same-day F2F'}". ` +
        `Clinician: ${appointmentModel.urgentSameDayF2F.clinicianRole || 'GP'}. ` +
        `Used for: ${appointmentModel.urgentSameDayF2F.description || 'urgent same-day face-to-face appointments'}.`
      )
    }
    
    if (appointmentModel.otherClinicianDirect.enabled) {
      enabledArchetypes.push(
        `Other clinician direct booking: local name "${appointmentModel.otherClinicianDirect.localName || 'specialist clinician'}". ` +
        `Clinician: ${appointmentModel.otherClinicianDirect.clinicianRole || 'varies'}. ` +
        `Used for: ${appointmentModel.otherClinicianDirect.description || 'direct booking with specialist clinicians (e.g., FCP, Pharmacist)'}.`
      )
    }

    // Add clinician archetypes section
    const enabledClinicianArchetypes: string[] = []
    const minorIllnessClinicianArchetype = (appointmentModel.clinicianArchetypes || []).find(ca => ca.key === 'ANP' && ca.enabled)
    const clinicianArchetypes = appointmentModel.clinicianArchetypes || []
    
    for (const archetype of clinicianArchetypes) {
      if (archetype.enabled) {
        const friendlyName = archetype.key === 'ANP' ? 'Minor Illness Clinician Appointment' :
                           archetype.key === 'PHARMACIST' ? 'Clinical Pharmacist' :
                           archetype.key === 'FCP' ? 'First Contact Physiotherapist' :
                           archetype.key === 'OTHER' ? 'Other clinician or service' :
                           archetype.key
        enabledClinicianArchetypes.push(
          `${friendlyName} (local name: "${archetype.localName || friendlyName}"). ` +
          `Role: ${archetype.role || 'varies'}. ` +
          `Used for: ${archetype.description || 'as appropriate for this clinician type'}.`
        )
      }
    }

    let clinicianArchetypesSection = ''
    if (enabledClinicianArchetypes.length > 0) {
      clinicianArchetypesSection = `\n\nADDITIONAL CLINICIAN APPOINTMENTS:\n${enabledClinicianArchetypes.join('\n\n')}`
    }

    // Build appointment selection rules with emphasis on clinician archetypes
    let appointmentSelectionRules = `APPOINTMENT SELECTION RULES:
- For stable or long-standing problems (e.g., hayfever, stable constipation, long-term rashes, recurrent infections without red flags, chronic ankle pain), prefer ${appointmentModel.routineContinuityGp.enabled ? `"${appointmentModel.routineContinuityGp.localName || 'routine continuity GP'}"` : 'routine continuity GP'} where continuity is helpful.
- For issues needing GP input within 48h but not same-day emergencies, use ${appointmentModel.gpTriage48h.enabled ? `"${appointmentModel.gpTriage48h.localName || 'GP triage (48h)'}"` : 'GP triage within 48 hours'}.`

    // Add explicit instructions for Minor Illness Clinician archetype if enabled
    if (minorIllnessClinicianArchetype) {
      const localName = minorIllnessClinicianArchetype.localName || 'Minor Illness Clinician Appointment'
      const role = minorIllnessClinicianArchetype.role || 'ANP / Paramedic / ACP'
      const description = minorIllnessClinicianArchetype.description || 'minor illnesses that do not require GP review'
      const restrictions = minorIllnessClinicianArchetype.restrictions || null

      appointmentSelectionRules += `
- **MINOR ILLNESS CLINICIAN — CONDITIONAL ROUTING ONLY**: This surgery has a Minor Illness Clinician appointment (local name: "${localName}", staffed by: ${role}, suitable for: ${description}).${restrictions ? ` Restrictions — do not use for: ${restrictions}.` : ''}
  IMPORTANT: Do NOT default to this appointment type. Only route to it when the base instruction clearly supports a minor illness pathway AND none of the following apply:
  * The base instruction contains red flags, complexity signals, or comorbidity warnings
  * The base instruction routes to Duty Team or urgent same-day care
  * The patient is under 5 and this clinic does not accept under 5s (see under-5s rule below)
  * The presentation falls within the restrictions listed above
  When in doubt, PRESERVE the original routing from the base instruction. Do not downgrade a GP routing to a Minor Illness Clinician routing unless the original instruction clearly and unambiguously supports it.`

      if (minorIllnessClinicianArchetype.acceptsUnderFives === false) {
        appointmentSelectionRules += `
- **UNDER 5s EXCLUSION**: The Minor Illness Clinician Appointment ("${localName}") does NOT accept patients under 5 years old. For children under 5 with minor illness symptoms, route to a GP appointment or Duty Team instead.`
      } else if (minorIllnessClinicianArchetype.acceptsUnderFives === true) {
        appointmentSelectionRules += `
- **UNDER 5s ACCEPTED**: The Minor Illness Clinician Appointment ("${localName}") can accept patients under 5 years old for appropriate minor illness presentations.`
      }
    }

    // Add other clinician archetype rules
    const pharmacistArchetype = (appointmentModel.clinicianArchetypes || []).find(ca => ca.key === 'PHARMACIST' && ca.enabled)
    const fcpArchetype = (appointmentModel.clinicianArchetypes || []).find(ca => ca.key === 'FCP' && ca.enabled)
    
    if (pharmacistArchetype) {
      const localName = pharmacistArchetype.localName || 'Clinical Pharmacist'
      appointmentSelectionRules += `
- Medicine queries and medication reviews should be routed to the Clinical Pharmacist appointment (local name: "${localName}") if this archetype is enabled, rather than to a GP appointment.`
    }
    
    if (fcpArchetype) {
      const localName = fcpArchetype.localName || 'First Contact Physiotherapist'
      appointmentSelectionRules += `
- MSK (musculoskeletal) problems should be routed to the First Contact Physiotherapist appointment (local name: "${localName}") if this archetype is enabled, rather than to a GP appointment.`
    }

    appointmentSelectionRules += `
- Use ${appointmentModel.urgentSameDayPhone.enabled ? `"${appointmentModel.urgentSameDayPhone.localName || 'urgent same-day telephone'}"` : 'urgent same-day telephone'} or ${appointmentModel.urgentSameDayF2F.enabled ? `"${appointmentModel.urgentSameDayF2F.localName || 'urgent same-day F2F'}"` : 'urgent same-day face-to-face'} ONLY for clearly urgent cases with red flags or when the original instructions explicitly require same-day care.
- Use GP urgent appointments or Duty Team only when the symptom or red flags explicitly require GP-level or senior review.

IMPORTANT: If an archetype is not enabled, do not use its local name. Instead, fall back to the closest enabled archetype or use generic terminology that matches the surgery's style.`

    appointmentModelInstruction = `APPOINTMENT TYPE MAPPING:
This surgery has defined the following appointment types. You MUST use these local names and follow their usage rules:

${enabledArchetypes.join('\n\n')}${clinicianArchetypesSection}

${appointmentSelectionRules}`
  }

  // Fallback to colour-slot logic if appointmentModel is not configured
  let colourSlotInstruction = ''
  if (!hasEnabledArchetypes) {
    // Detect if surgery uses colour-coded slots
    const profileText = JSON.stringify(onboardingProfile).toLowerCase()
    const usesColourSlots =
      profileText.includes('orange slot') ||
      profileText.includes('red slot') ||
      profileText.includes('pink/purple slot') ||
      profileText.includes('pink slot') ||
      profileText.includes('purple slot') ||
      onboardingProfile.urgentCareModel.urgentSlotsDescription.toLowerCase().includes('slot')

    if (usesColourSlots) {
      colourSlotInstruction = `This surgery uses colour-coded urgent appointment types as described in their onboarding profile. You must keep and use these terms consistently with the profile, using the following semantic definitions:

- Green slot: A routine GP appointment, ideally with continuity (the patient's usual GP if possible). Not urgent.
- Pink/Purple slot: A GP telephone triage appointment within 48 hours. Not a same-day emergency. Not a long-term continuity appointment. Used when GP input is needed soon, but the problem does not require the Duty Team.
- Orange slot: A same-day urgent face-to-face GP appointment following GP triage.
- Red slot: A same-day urgent telephone call with the Duty Doctor, usually when no orange slots remain.

Use these semantics to interpret what type of appointment each colour represents.`
    } else {
      colourSlotInstruction = `This surgery does not use colour-coded slot names. If the base instructions mention colour-labelled slots, you must rewrite them into the following neutral equivalents:

- Green slot → "routine GP appointment with continuity"
- Pink/Purple slot → "GP telephone triage appointment within 48 hours"
- Orange slot → "urgent same-day face-to-face GP appointment"
- Red slot → "urgent same-day telephone consultation with the Duty Team"

Do not invent new colour names. Use neutral wording that matches the surgery's onboarding profile terminology.`
    }
  }

  // Extract appointment workflow context from onboarding profile
  const appointmentWorkflowText = onboardingProfile.urgentCareModel.urgentSlotsDescription?.trim() || ''
  let appointmentWorkflowInstruction = ''
  if (appointmentWorkflowText) {
    appointmentWorkflowInstruction = `APPOINTMENT WORKFLOW CONTEXT:
The surgery has described their real-world appointment workflow as follows (who can book which appointments, how urgent slots are selected, and any sequencing rules):

"${appointmentWorkflowText}"

You must respect this workflow when choosing appointment types in your rewritten instructions. In particular, follow their rules about who can book urgent appointments, which urgent slots are used first, and any special exceptions.`
  }

  const systemPrompt = `You are rewriting admin-facing signposting instructions for a specific GP surgery.

Your task is to adapt generic symptom signposting guidance to match this surgery's:
- Real terminology (e.g., duty doctor name, slot names, team roles)
- Local services (MSK, mental health, community nursing, etc.)
- Role setup (who can book what directly)
- Urgent care model (duty doctor, red slots, escalation pathways)
- Preferred communication detail level and terminology style

CRITICAL SAFETY RULES:
- Maintain clinical safety exactly as written in the base instructions. Do NOT dilute urgency, red flags, or escalation criteria.
- Keep content strictly within admin signposting scope — do NOT create new clinical advice.
- Preserve all clinical meaning, time frames, and safety triggers exactly.

CONTINUITY AND ESCALATION RULES:
- For stable or long-standing problems (e.g., hayfever, stable constipation, long-term rashes, recurrent infections without red flags, chronic ankle pain), prioritise continuity of care by booking with the patient's usual GP where possible. Do not redirect these cases to the Duty Team.
- Use Duty Team only when clearly acute, i.e., when:
  * The original instructions contain red-flags, OR
  * The onboarding profile specifically directs urgent use.
- Never escalate non-urgent issues to Duty Team. Non-urgent cases should map to:
  * Continuity GP (Green slot equivalent), OR
  * 48h GP triage (Pink/Purple slot equivalent) if more suitable,
  * but NOT same-day urgent or Duty Team unless explicitly urgent.

IMPROVEMENT GOALS:
- Improve clarity, structure, readability, and workflow for reception/admin teams.
- Use the surgery's preferred terminology (e.g., their duty doctor term, slot names).
- Follow the surgery's preferred communication detail level (brief/moderate/detailed).
- Follow the surgery's terminology preference (surgery-specific vs generic vs mixed).
- Do NOT add routing pathways or clinical steps that do not exist in the base instruction. Only rewrite what is already there — do not invent new steps.

${hasEnabledArchetypes ? appointmentModelInstruction : `COLOUR-SLOT TERMINOLOGY:
${colourSlotInstruction}`}

${appointmentWorkflowInstruction ? `${appointmentWorkflowInstruction}

` : ''}EMOJI ICONS:
Where helpful, you may add small emoji icons at the start of lines or sections to act as visual anchors. ONLY use icons from this approved list:
- ❗ for important warnings or high-risk "Red Slot" rules.
- ➜ for clear action steps (e.g. booking rules, who to signpost to).
- 💊 for Pharmacy / Pharmacy First related instructions.
- 🧒 for child-specific rules (e.g. under 5s or paediatric advice).
- ℹ️ for neutral information / general advice.
- 📞 for telephone consultations or phone contact instructions.
- 🐾 for animal bites/scratches.
- 🐝 for insect bites/stings.

Use at most 1–2 emojis per short section, and only when they clearly improve scannability for non-clinical staff. Place the emoji at the start of the line or bullet, followed by a space, then the text. Do not use any other emojis or icons.

Emojis should mainly appear in the detailed instructions (the instructionsHtml output), and can occasionally appear in the briefInstruction if appropriate, but must not overwhelm the text.

Preserve the original meaning while improving clarity.

OUTPUT FORMAT:
Return ONLY valid JSON with these exact fields:
{
  "briefInstruction": "string - improved brief routing label",
  "instructionsHtml": "string - rewritten full instruction in clean HTML suitable for TipTap/sanitisation"
}

Use simple HTML tags: <p>, <ul>, <li>, <strong>, <em>, <br />. Ensure HTML is clean and suitable for sanitisation. Emojis should be included directly in the HTML text content (they are valid Unicode characters in HTML).`

  // Build user prompt with symptom and profile data
  const userPrompt = `SYMPTOM TO CUSTOMISE:
Name: ${baseSymptom.name}
Age Group: ${baseSymptom.ageGroup}
Brief Instruction: ${baseSymptom.briefInstruction || '(none)'}
Full Instructions: ${baseSymptom.instructionsHtml || '(none)'}

SURGERY ONBOARDING PROFILE:
${JSON.stringify(onboardingProfile, null, 2)}

TASK:
Rewrite the symptom instructions to match this surgery's:
1. Terminology (use their duty doctor term, slot names, team roles)
2. Local services (reference their specific services where relevant)
3. Booking rules (reflect who can book directly)
4. Escalation pathways (use their first escalation point and urgent wording)
5. Communication style (match their detail level and terminology preference)

IMPORTANT:
- Maintain all clinical safety exactly as written.
- Use icons/phrases that match ImageIcon rules when helpful.
- Produce clean HTML suitable for TipTap/sanitisation.
- Keep briefInstruction concise and routing-focused.

Return ONLY the JSON object with briefInstruction and instructionsHtml fields.`

  // Call Azure OpenAI API
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Azure OpenAI API error:', response.status, errorText)
    throw new Error(`AI service error: ${response.status}`)
  }

  const data = await response.json()
  const rawContent = data.choices?.[0]?.message?.content || ''

  let briefInstruction = ''
  let instructionsHtml = ''

  try {
    const parsed = JSON.parse(rawContent)
    briefInstruction = parsed.briefInstruction || baseSymptom.briefInstruction || ''
    instructionsHtml = parsed.instructionsHtml || ''
  } catch (err) {
    console.error('Failed to parse AI response as JSON:', err)
    throw new Error('Invalid AI response format')
  }

  if (!instructionsHtml) {
    throw new Error('AI response missing instructionsHtml')
  }

  const modelUsed = data.model || deployment

  // Log token usage (non-blocking)
  try {
    const promptTokens = data.usage?.prompt_tokens ?? 0
    const completionTokens = data.usage?.completion_tokens ?? 0
    const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens)

    const inputRate = parseFloat(process.env.AZURE_OPENAI_COST_INPUT_PER_1K_USD || '0')
    const outputRate = parseFloat(process.env.AZURE_OPENAI_COST_OUTPUT_PER_1K_USD || '0')

    const estimatedCostUsd =
      ((promptTokens * inputRate) + (completionTokens * outputRate)) / 1000

    await prisma.tokenUsageLog.create({
      data: {
        userEmail,
        route: 'customiseInstructions',
        modelUsed,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
      },
    })
  } catch (error) {
    // Don't block the response if logging fails
    console.error('Failed to log token usage:', error)
  }

  return {
    briefInstruction,
    instructionsHtml,
    modelUsed,
  }
}

