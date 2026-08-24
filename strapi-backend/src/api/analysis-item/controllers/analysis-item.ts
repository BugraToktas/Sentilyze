/**
 * analysis-item controller
 *
 * - create:    kullanıcıyı + job_id'yi otomatik ata
 * - find:      sadece giriş yapan kullanıcının kayıtlarını döndür
 * - bulkCreate: tek istekte çok sayıda item oluştur (özel endpoint için)
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController(
    'api::analysis-item.analysis-item',
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
