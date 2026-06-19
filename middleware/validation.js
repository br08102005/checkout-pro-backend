const Validator = {
  // Validação de email
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof email === 'string' && emailRegex.test(email);
  },

  // Validação de telefone (9 dígitos)
  isValidPhone(phone) {
    const phoneRegex = /^[0-9]{9}$/;
    return typeof phone === 'string' && phoneRegex.test(phone);
  },

  // Validação de slug
  isValidSlug(slug) {
    const slugRegex = /^[a-z0-9-]+$/;
    return typeof slug === 'string' && slugRegex.test(slug) && slug.length > 0;
  },

  // Validação de preço
  isValidPrice(price) {
    const num = Number(price);
    return !isNaN(num) && num > 0;
  },

  // Validação de campos obrigatórios
  validateRequired(data, fields) {
    const missing = fields.filter(field => {
      const value = data[field];
      return value === undefined || value === null || value === '';
    });
    return {
      valid: missing.length === 0,
      missing,
      error: missing.length > 0 ? `Campos obrigatórios faltando: ${missing.join(', ')}` : null
    };
  },

  // Validação de UUID
  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return typeof uuid === 'string' && uuidRegex.test(uuid);
  },

  // Validação de nome
  isValidName(name) {
    return typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 100;
  },

  // Sanitização de string
  sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/[<>]/g, '');
  },

  // Validação de array
  isValidArray(arr) {
    return Array.isArray(arr);
  },

  // Validação de número positivo
  isPositiveNumber(num) {
    const n = Number(num);
    return !isNaN(n) && n > 0;
  },

  // Validação de status de pedido
  isValidOrderStatus(status) {
    const validStatuses = ['pending', 'paid', 'cancelled'];
    return validStatuses.includes(status);
  },

  // Validação de tipo de entrega
  isValidDeliveryType(type) {
    const validTypes = ['none', 'link', 'pdf', 'text', 'member_area'];
    return validTypes.includes(type);
  },

  // Validação de tipo de integração
  isValidIntegrationType(type) {
    const validTypes = ['webhook', 'meta_pixel', 'ga4', 'gtm', 'stripe', 'paypal', 'custom'];
    return validTypes.includes(type);
  },

  // Middleware para validar request body
  validateBody(fields) {
    return (req, res, next) => {
      const validation = this.validateRequired(req.body, fields);
      
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      next();
    };
  },

  // Middleware para validar params
  validateParams(fields) {
    return (req, res, next) => {
      const validation = this.validateRequired(req.params, fields);
      
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      next();
    };
  },

  // Middleware para validar query params
  validateQuery(fields) {
    return (req, res, next) => {
      const validation = this.validateRequired(req.query, fields);
      
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      next();
    };
  }
};

module.exports = Validator;