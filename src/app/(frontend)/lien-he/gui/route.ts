import config from '@payload-config';
import { getPayload } from 'payload';
import { handleContactPost } from '../../../../lib/contact-endpoint';

// Write-only public endpoint: it never returns lead data, and there is no GET/PUT/DELETE here.
export const POST = (request: Request) => handleContactPost(request, { getPayload: () => getPayload({ config }) });
