/* Configuração pública do Honra (Landing Page, App, LGPD e Meta Ads).
 * Preencha metaPixelId e whatsappNumero antes de publicar suas campanhas. */
window.HONRA_CONFIG = Object.freeze({
  /* ID do Pixel da Meta (15 a 16 dígitos, ex: '123456789012345').
   * Deixe vazio '' enquanto não estiver configurado. */
  metaPixelId: '',

  /* WhatsApp comercial com DDI + DDD, só números (ex: '5543999990000').
   * Quando preenchido, ativa o botão de atendimento no site e na página de assinatura. */
  whatsappNumero: '',
  whatsappMensagem: 'Olá! Vi o Honra e quero tirar uma dúvida sobre o sistema para advogados.',

  /* Contato oficial (exibido na Política de Privacidade, Termos de Uso e rodapé). */
  emailContato: 'contato@imaguiar.com.br',
  empresaNome: 'Honra · Gestão para advogados',
  empresaDoc: '', /* Opcional: ex: 'CNPJ 00.000.000/0001-00' */

  /* Oferta comercial exibida na LP e nos eventos de conversão */
  precoMensal: 69.90,
  diasTeste: 7,
  siteUrl: 'https://honra.imaguiar.com.br'
});
