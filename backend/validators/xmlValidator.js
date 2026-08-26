const { z } = require("zod"); exports.xmlIdSchema = z.object({ xmlId: z.string().min(1) });
