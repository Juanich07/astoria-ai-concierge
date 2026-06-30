import { resorts } from './resorts';
import { faqs } from './faqs';
import { services } from './services';

const resortFacts = resorts
  .map(
    (resort) =>
      `- ${resort.name} (${resort.location}): ${resort.description} Amenities include ${resort.amenities.join(', ')}.`
  )
  .join('\n');

const serviceFacts = services
  .map((service) => `- ${service.title}: ${service.description}`)
  .join('\n');

const faqFacts = faqs
  .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
  .join('\n\n');

export const knowledgePrompt = `Use the following Astoria Resorts information to answer guest concierge questions. When the guest asks about amenities, resort features, services, or policies, base your responses on these details.

Resorts:
${resortFacts}

Services:
${serviceFacts}

Frequently asked questions:
${faqFacts}`;
