import { productionApi } from '../server/vercel.ts';
export default { fetch: (request: Request) => productionApi(request, '/api/access') };
