import { PrismaClient } from '../src/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-law-firm' },
    update: {},
    create: {
      name: 'Demo Law Firm',
      slug: 'demo-law-firm',
      status: 'active',
      timezone: 'America/New_York',
    },
  });
  console.log('Created organization:', org.name);

  // Create Owner User
  const passwordHash = await bcrypt.hash('DemoPass123!', 12);
  const owner = await prisma.user.upsert({
    where: {
      orgId_email: {
        orgId: org.id,
        email: 'owner@demo.com',
      },
    },
    update: {},
    create: {
      orgId: org.id,
      email: 'owner@demo.com',
      name: 'Demo Owner',
      role: 'owner',
      status: 'active',
      passwordHash: passwordHash,
    },
  });
  console.log('Created owner user:', owner.email);

  // Create Practice Areas
  const practiceAreas = await Promise.all([
    prisma.practiceArea.upsert({
      where: {
        id: 'personal-injury-' + org.id,
      },
      update: {},
      create: {
        id: 'personal-injury-' + org.id,
        orgId: org.id,
        name: 'Personal Injury',
        active: true,
      },
    }),
    prisma.practiceArea.upsert({
      where: {
        id: 'criminal-defense-' + org.id,
      },
      update: {},
      create: {
        id: 'criminal-defense-' + org.id,
        orgId: org.id,
        name: 'Criminal Defense',
        active: true,
      },
    }),
  ]);
  console.log('Created practice areas:', practiceAreas.map(pa => pa.name).join(', '));

  // Create Intake Question Set
  const questionSet = await prisma.intakeQuestionSet.upsert({
    where: {
      id: 'default-intake-' + org.id,
    },
    update: {},
    create: {
      id: 'default-intake-' + org.id,
      orgId: org.id,
      practiceAreaId: practiceAreas[0].id,
      name: 'Standard Personal Injury Intake',
      version: 1,
      active: true,
      schema: {
        version: '1.0',
        sections: [
          {
            id: 'contact_info',
            title: 'Contact Information',
            questions: [
              {
                id: 'full_name',
                type: 'text',
                label: 'Full Legal Name',
                required: true,
              },
              {
                id: 'phone',
                type: 'phone',
                label: 'Best Phone Number',
                required: true,
              },
              {
                id: 'email',
                type: 'email',
                label: 'Email Address',
                required: false,
              },
            ],
          },
          {
            id: 'incident_details',
            title: 'Incident Details',
            questions: [
              {
                id: 'incident_date',
                type: 'date',
                label: 'When did the incident occur?',
                required: true,
              },
              {
                id: 'incident_location',
                type: 'text',
                label: 'Where did the incident occur?',
                required: true,
              },
              {
                id: 'incident_description',
                type: 'textarea',
                label: 'Please describe what happened',
                required: true,
              },
              {
                id: 'injuries',
                type: 'textarea',
                label: 'What injuries did you sustain?',
                required: true,
              },
              {
                id: 'medical_treatment',
                type: 'radio',
                label: 'Have you sought medical treatment?',
                required: true,
                options: ['Yes', 'No', 'Planned'],
              },
            ],
          },
          {
            id: 'parties',
            title: 'Other Parties',
            questions: [
              {
                id: 'other_party_name',
                type: 'text',
                label: 'Name of other party involved (if known)',
                required: false,
              },
              {
                id: 'other_party_insurance',
                type: 'text',
                label: 'Other party\'s insurance company (if known)',
                required: false,
              },
              {
                id: 'police_report',
                type: 'radio',
                label: 'Was a police report filed?',
                required: true,
                options: ['Yes', 'No', 'Unknown'],
              },
            ],
          },
        ],
      },
    },
  });
  console.log('Created intake question set:', questionSet.name);

  // Create AI Config
  const aiConfig = await prisma.aiConfig.upsert({
    where: {
      orgId: org.id,
    },
    update: {},
    create: {
      orgId: org.id,
      voiceGreeting: 'Thank you for calling Demo Law Firm. My name is Alex, and I\'m an AI assistant here to help you with your legal matter. How can I assist you today?',
      disclaimerText: 'Please note that I am an AI assistant and cannot provide legal advice. Our conversation will be recorded and reviewed by our legal team. If this is an emergency, please hang up and dial 911.',
      toneProfile: {
        style: 'professional',
        empathy_level: 'high',
        formality: 'moderate',
        pace: 'calm',
      },
      handoffRules: {
        emergency_keywords: ['emergency', 'danger', 'threat', 'hurt', 'police'],
        escalation_triggers: ['speak to attorney', 'talk to lawyer', 'human'],
        business_hours: {
          start: '09:00',
          end: '17:00',
          timezone: 'America/New_York',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      },
      qualificationRules: {
        min_score_for_accept: 70,
        min_score_for_review: 40,
        required_fields: ['incident_date', 'incident_location', 'injuries'],
        disqualifiers: ['statute_of_limitations_expired', 'no_injury', 'pre_existing_attorney'],
        scoring_weights: {
          injury_severity: 0.3,
          liability_clarity: 0.25,
          damages_potential: 0.25,
          urgency: 0.2,
        },
      },
    },
  });
  console.log('Created AI config for org:', org.name);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
