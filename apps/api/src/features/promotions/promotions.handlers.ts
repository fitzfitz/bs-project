import { createRoute, z, RouteHandler } from '@hono/zod-openapi';
import { promotionsService } from './promotions.service';
import { 
  ValidatePromoCodeSchema, 
  CreatePromoCodeSchema, 
  UpdatePromoCodeSchema,
  PromoCodeSchema,
  PromoCodeIdParamSchema,
} from './promotions.schema';
import { AppEnv } from '../../types';

export const listPromoCodesRoute = createRoute({
  method: 'get',
  path: '/',
  summary: 'List promo codes',
  tags: ['Promotions'],
  responses: {
    200: {
      description: 'List of promo codes',
      content: {
        'application/json': {
          schema: z.array(PromoCodeSchema),
        },
      },
    },
  },
});

export const createPromoCodeRoute = createRoute({
  method: 'post',
  path: '/',
  summary: 'Create a new promo code',
  tags: ['Promotions'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePromoCodeSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Promo code created',
      content: {
        'application/json': {
          schema: PromoCodeSchema,
        },
      },
    },
  },
});

export const updatePromoCodeRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  summary: 'Update a promo code',
  tags: ['Promotions'],
  request: {
    params: PromoCodeIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdatePromoCodeSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Promo code updated',
      content: {
        'application/json': {
          schema: PromoCodeSchema,
        },
      },
    },
    404: { description: 'Promo code not found' },
  },
});

export const deletePromoCodeRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  summary: 'Delete a promo code',
  tags: ['Promotions'],
  request: {
    params: PromoCodeIdParamSchema,
  },
  responses: {
    200: {
      description: 'Promo code deleted',
      content: {
        'application/json': {
          schema: PromoCodeSchema,
        },
      },
    },
    404: { description: 'Promo code not found' },
  },
});

export const validatePromoCodeRoute = createRoute({
  method: 'post',
  path: '/validate',
  summary: 'Validate a promo code',
  tags: ['Promotions'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ValidatePromoCodeSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Validation result',
      content: {
        'application/json': {
          schema: z.object({
            promoCode: z.string(),
            discountAmount: z.number(),
            type: z.string(),
            value: z.number(),
          }),
        },
      },
    },
    400: { description: 'Invalid promo code' },
    404: { description: 'Promo code not found' },
  },
});

export const validateLoyaltyRoute = createRoute({
  method: 'post',
  path: '/validate-loyalty',
  summary: 'Validate loyalty points redemption',
  tags: ['Promotions'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            userId: z.string(),
            pointsToRedeem: z.number(),
            netAmount: z.number(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Validation result',
      content: {
        'application/json': {
          schema: z.object({
            pointsToRedeem: z.number(),
            discountAmount: z.number(),
          }),
        },
      },
    },
    400: { description: 'Invalid redemption' },
    404: { description: 'Account not found' },
  },
});

export const listPromoCodesHandler: RouteHandler<typeof listPromoCodesRoute, AppEnv> = async (c) => {
  const db = c.get('db');
  const promoCodes = await promotionsService.listPromoCodes(db);
  return c.json(promoCodes, 200);
};

export const createPromoCodeHandler: RouteHandler<typeof createPromoCodeRoute, AppEnv> = async (c) => {
  const db = c.get('db');
  const data = c.req.valid('json');
  const organizationId = c.get('organizationId')!;
  const promoCode = await promotionsService.createPromoCode(db, data, organizationId);
  return c.json(promoCode, 201);
};

export const updatePromoCodeHandler: RouteHandler<typeof updatePromoCodeRoute, AppEnv> = async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const promoCode = await promotionsService.updatePromoCode(db, id, data);
  return c.json(promoCode, 200);
};

export const deletePromoCodeHandler: RouteHandler<typeof deletePromoCodeRoute, AppEnv> = async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const promoCode = await promotionsService.deletePromoCode(db, id);
  return c.json(promoCode, 200);
};

export const validatePromoCodeHandler: RouteHandler<typeof validatePromoCodeRoute, AppEnv> = async (c) => {
  const db = c.get('db');
  const data = c.req.valid('json');
  const organizationId = c.get('organizationId')!;
  const result = await promotionsService.validatePromoCode(db, { ...data, organizationId });
  return c.json(result, 200);
};

export const validateLoyaltyHandler: RouteHandler<typeof validateLoyaltyRoute, AppEnv> = async (c) => {
  const db = c.get('db');
  const { userId, pointsToRedeem, netAmount } = c.req.valid('json');
  const result = await promotionsService.validateLoyaltyRedemption(db, userId, pointsToRedeem, netAmount);
  return c.json(result, 200);
};
