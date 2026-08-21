/**
 * live-session controller
 *
 * - create: kayıt oluşturulurken JWT'den gelen kullanıcı id'sini ata
 * - find:   her zaman sadece giriş yapan kullanıcının oturumlarını döndür
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController(
    'api::live-session.live-session',
    ({ strapi: _strapi }) => ({
        async create(ctx) {
            const user = ctx.state.user;
            if (!user) return ctx.unauthorized('Kimlik doğrulama gerekli');

            const body = ctx.request.body as { data?: Record<string, unknown> };
            body.data = {
                ...(body.data ?? {}),
                user_id: user.id,
            };

            return super.create(ctx);
        },

        async find(ctx) {
            const user = ctx.state.user;
            if (!user) return ctx.unauthorized('Kimlik doğrulama gerekli');

            const filters = (ctx.query.filters ?? {}) as Record<string, unknown>;
            filters['user_id'] = { $eq: user.id };
            ctx.query.filters = filters;

            return super.find(ctx);
        },
    }),
);
