// OpenAPI 3 description of the changes API, served at /api/openapi and rendered by Swagger UI at /api/docs.
const ChangeInput = {
  type: 'object',
  required: ['chg', 'project', 'date', 'type', 'result'],
  properties: {
    chg: { type: 'string', maxLength: 60, example: 'CHG0034567' },
    project: { type: 'string', maxLength: 200, example: 'Migración portal clientes' },
    team: { type: 'string', maxLength: 60, default: 'CX', example: 'CX' },
    date: { type: 'string', format: 'date', description: 'Fecha de implementación (AAAA-MM-DD)', example: '2026-03-14' },
    type: { type: 'string', enum: ['planned', 'emergency'] },
    result: { type: 'string', enum: ['successful', 'unsuccessful', 'rollback', 'open'], description: '`open` = todavía sin cerrar' },
    notes: { type: 'string', maxLength: 500, default: '' },
  },
};

const Change = {
  allOf: [
    { $ref: '#/components/schemas/ChangeInput' },
    {
      type: 'object',
      required: ['id', 'createdAt'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        createdAt: { type: 'integer', description: 'Epoch en milisegundos' },
        updatedAt: { type: 'integer', nullable: true, description: 'Epoch en milisegundos' },
      },
    },
  ],
};

const ErrorSchema = { type: 'object', properties: { error: { type: 'string', example: 'Falta el número de CHG.' } } };

const err = (description) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const body = { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangeInput' } } } };
const changeRes = (description) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Change' } } } });

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Implemented Changes Tracker API',
    version: '1.0.0',
    description: 'Alta, baja y modificación de CHGs usados para el reporte mensual de cambios implementados.',
  },
  servers: [{ url: '/' }],
  tags: [{ name: 'Changes' }],
  paths: {
    '/api/changes': {
      get: {
        tags: ['Changes'],
        summary: 'Listar todos los cambios',
        responses: {
          200: {
            description: 'Lista ordenada por fecha descendente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    storage: { type: 'string', enum: ['file', 'postgres', 'missing-db'], description: 'Dónde se guardan los datos' },
                    changes: { type: 'array', items: { $ref: '#/components/schemas/Change' } },
                  },
                },
              },
            },
          },
          500: err('Error al leer'),
        },
      },
      post: {
        tags: ['Changes'],
        summary: 'Crear un cambio',
        requestBody: body,
        responses: { 201: changeRes('Cambio creado'), 400: err('Datos inválidos'), 500: err('Error al guardar') },
      },
    },
    '/api/changes/{id}': {
      parameters: [idParam],
      put: {
        tags: ['Changes'],
        summary: 'Actualizar un cambio (reemplaza todos los campos)',
        requestBody: body,
        responses: { 200: changeRes('Cambio actualizado'), 400: err('Datos inválidos'), 404: err('No existe'), 500: err('Error al guardar') },
      },
      delete: {
        tags: ['Changes'],
        summary: 'Borrar un cambio',
        responses: { 204: { description: 'Borrado' }, 404: err('No existe'), 500: err('Error al borrar') },
      },
    },
  },
  components: { schemas: { ChangeInput, Change, Error: ErrorSchema } },
};
