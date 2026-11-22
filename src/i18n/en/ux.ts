import type { Catalog } from '../translate';

/** Traducciones al inglés: área "ux" (ajustes de la crítica de diseño del panel, nov-2026). Clave = texto en español tal como aparece en el código. */
const catalog: Catalog = {
  // Inicio: bienvenida con el paso siguiente
  'Tu negocio ya está listo. Empieza por aquí:': 'Your business is ready. Start here:',
  'Tu sitio ya está listo. Empieza por aquí:': 'Your site is ready. Start here:',
  'Agrega tu primer producto': 'Add your first product',
  'Sube una foto a tu primer producto': 'Add a photo to your first product',
  'Ver como cliente': 'View as a customer',
  // Inicio: revisión del catálogo (singular / plural)
  '1 producto sin precio.': '1 product without a price.',
  '{count} productos sin precio.': '{count} products without a price.',
  '1 marcado como agotado.': '1 marked as sold out.',
  '{count} marcados como agotados.': '{count} marked as sold out.',
  '1 oculto: no se muestra al público.': "1 hidden: it isn't shown to the public.",
  '{count} ocultos: no se muestran al público.': "{count} hidden: they aren't shown to the public.",
  // Inicio: uso del plan en una línea
  'Plan {plan}: {count} de {max} productos y servicios.': '{plan} plan: {count} of {max} products and services.',
  // Ficha del ítem
  'Ver en el sitio': 'View on the site',
  'Insignias': 'Badges',
  'Insignia personalizada': 'Custom badge',
  'Color de la insignia': 'Badge color',
  // Lista de ítems
  '1 ficha vista en 30 días': '1 page view in 30 days',
  '{count} fichas vistas en 30 días': '{count} page views in 30 days',
  '1 unidad pedida en 30 días': '1 unit ordered in 30 days',
  '{count} unidades pedidas en 30 días': '{count} units ordered in 30 days',
  'Ocultar del catálogo': 'Hide from the catalog',
  'Mostrar en el catálogo': 'Show in the catalog',
  // Pedidos: avisos y cancelación
  'Avisos en este dispositivo': 'Notifications on this device',
  'No se pudieron activar los avisos. Intenta de nuevo.': "Couldn't turn on notifications. Try again.",
  '¿Cancelar el pedido {reference}?': 'Cancel order {reference}?',
  'Pasa a Cancelados y deja de contar como pendiente. Si te equivocas, puedes volverlo a nuevo.': "It moves to Cancelled and no longer counts as pending. If it's a mistake, you can set it back to new.",
  // Reseñas: rechazar y responder
  '¿Rechazar la reseña de {name}?': "Reject {name}'s review?",
  'No se publica. Queda en Rechazadas y puedes publicarla después si cambias de opinión.': "It won't be published. It stays under Rejected and you can publish it later if you change your mind.",
  'Respuesta guardada': 'Reply saved',
  'Guardar respuesta': 'Save reply',
  'Tu respuesta (se publica con la reseña)': 'Your reply (published with the review)',
  '¿Quitar tu respuesta?': 'Remove your reply?',
  'Se borra la respuesta guardada. La reseña sigue pendiente.': 'The saved reply is deleted. The review stays pending.',
  'Deja de verse en tu sitio. Puedes escribir otra cuando quieras.': "It disappears from your site. You can write another one whenever you like.",
  // Publicación: qué ven tus clientes (singular / plural)
  '1 ítem visible': '1 visible item',
  '{count} ítems visibles': '{count} visible items',
  '1 oculto (sólo tú lo ves).': '1 hidden (only you see it).',
  '{count} ocultos (sólo tú los ves).': '{count} hidden (only you see them).',
  // Categorías (singular / plural)
  'Su ítem no se borra: quedará como "Sin categoría".': 'Its item is not deleted: it will become "Uncategorized".',
  'Sus {count} ítems no se borran: quedarán como "Sin categoría".': 'Its {count} items are not deleted: they will become "Uncategorized".',
  '1 ítem': '1 item',
  '{count} ítems': '{count} items',
};

export default catalog;
