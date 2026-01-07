export interface ToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export const INTAKE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    name: "create_lead",
    description: "Create a new lead/contact in the system when you have the caller's name and phone number. Call this early in the conversation once you have basic info.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Full name of the caller (first and last name)",
        },
        phone: {
          type: "string",
          description: "Phone number in E.164 format (e.g., +15551234567) or standard format",
        },
        email: {
          type: "string",
          description: "Email address if provided",
        },
        source: {
          type: "string",
          description: "How the lead came in",
          enum: ["phone_call", "sms", "web_chat", "referral"],
        },
        practiceArea: {
          type: "string",
          description: "The type of legal matter if identifiable",
          enum: ["personal_injury", "family_law", "criminal_defense", "immigration", "employment", "real_estate", "estate_planning", "business", "other"],
        },
      },
      required: ["name", "phone"],
    },
  },
  {
    type: "function",
    name: "save_intake_answers",
    description: "Save or update the intake questionnaire answers as you collect information from the caller. Call this multiple times as you gather more details.",
    parameters: {
      type: "object",
      properties: {
        answers: {
          type: "string",
          description: "JSON object with intake answers. Keys can include: description, incident_date, incident_location, injuries, urgency, best_callback_time, additional_notes",
        },
      },
      required: ["answers"],
    },
  },
  {
    type: "function",
    name: "update_lead",
    description: "Update the lead's status, priority, or summary after gathering information.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Current status of the lead",
          enum: ["new", "contacted", "qualified", "unqualified", "converted", "lost"],
        },
        priority: {
          type: "string",
          description: "Priority level based on urgency",
          enum: ["low", "medium", "high", "urgent"],
        },
        summary: {
          type: "string",
          description: "Brief summary of the caller's legal matter (1-2 sentences)",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "warm_transfer",
    description: "Request a warm transfer to a human staff member. Use only when the caller explicitly asks to speak with a person immediately, or in emergency situations.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Reason for the transfer request",
        },
        urgency: {
          type: "string",
          description: "Urgency level of the transfer",
          enum: ["routine", "urgent", "emergency"],
        },
      },
      required: ["reason"],
    },
  },
  {
    type: "function",
    name: "end_call",
    description: "Properly end the call after completing the intake. Summarizes the call and logs completion.",
    parameters: {
      type: "object",
      properties: {
        outcome: {
          type: "string",
          description: "How the call ended",
          enum: ["intake_complete", "transfer_requested", "caller_hangup", "callback_scheduled", "wrong_number"],
        },
        notes: {
          type: "string",
          description: "Any final notes about the call",
        },
      },
      required: ["outcome"],
    },
  },
];

export function getToolSchemas(): ToolDefinition[] {
  return INTAKE_TOOLS;
}
