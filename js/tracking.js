/* Rastreamento leve para Meta Ads (Pixel + UTMs + fbclid/_fbc/_fbp).
 * Só carrega o script da Meta quando HONRA_CONFIG.metaPixelId estiver preenchido. */
(function () {
  var CFG = window.HONRA_CONFIG || {};
  var ATTR_KEY = 'honra-utm-v1';
  var ATTR_TTL = 30 * 864e5; /* 30 dias */
  var PIXEL_ID = String(CFG.metaPixelId || '').replace(/\D/g, '');
  var PRECO = Number(CFG.precoMensal || 69.9);
  var iniciado = false;

  function lerCookie(nome) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + nome + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  }

  function gravarCookie(nome, valor, dias) {
    try {
      var exp = new Date(Date.now() + dias * 864e5).toUTCString();
      document.cookie = nome + '=' + encodeURIComponent(valor) + '; expires=' + exp + '; path=/; SameSite=Lax';
    } catch (e) {}
  }

  function capturarUTMs() {
    try {
      var q = new URLSearchParams(location.search);
      var chaves = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
      var achou = {};
      var temNovo = false;
      chaves.forEach(function (k) {
        var v = q.get(k);
        if (v) { achou[k] = v.slice(0, 200); temNovo = true; }
      });
      if (achou.fbclid && !lerCookie('_fbc')) {
        gravarCookie('_fbc', 'fb.1.' + Date.now() + '.' + achou.fbclid, 90);
      }
      var atual = getAttribution();
      if (temNovo) {
        var salvo = Object.assign({}, atual, achou, {
          landing: location.pathname,
          referrer: document.referrer ? document.referrer.slice(0, 200) : (atual.referrer || ''),
          capturado_em: Date.now()
        });
        localStorage.setItem(ATTR_KEY, JSON.stringify(salvo));
      }
    } catch (e) {}
  }

  function getAttribution() {
    var base = {};
    try {
      var raw = localStorage.getItem(ATTR_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && (!d.capturado_em || Date.now() - d.capturado_em < ATTR_TTL)) base = d;
      }
    } catch (e) {}
    var fbc = lerCookie('_fbc');
    var fbp = lerCookie('_fbp');
    if (fbc) base.fbc = fbc;
    if (fbp) base.fbp = fbp;
    return base;
  }

  function iniciarPixel() {
    if (iniciado || !PIXEL_ID) return;
    iniciado = true;
    /* Snippet padrão do Meta Pixel */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  function track(evento, params, eventId) {
    if (!PIXEL_ID || typeof window.fbq !== 'function') return;
    try {
      var opts = eventId ? { eventID: String(eventId) } : undefined;
      if (opts) window.fbq('track', evento, params || {}, opts);
      else window.fbq('track', evento, params || {});
    } catch (e) {}
  }

  function gerarId(prefixo) {
    return (prefixo || 'ev') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function whatsappUrl(msgExtra) {
    var num = String(CFG.whatsappNumero || '').replace(/\D/g, '');
    if (!num) return '';
    var txt = msgExtra || CFG.whatsappMensagem || 'Olá! Quero saber mais sobre o Honra.';
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(txt);
  }

  capturarUTMs();
  iniciarPixel();

  window.HonraTrack = Object.freeze({
    pixelAtivo: Boolean(PIXEL_ID),
    getAttribution: getAttribution,
    whatsappUrl: whatsappUrl,
    gerarId: gerarId,
    viewContent: function (nome) {
      track('ViewContent', {
        content_name: nome || 'Landing Page Honra',
        content_category: 'SaaS Juridico',
        currency: 'BRL',
        value: PRECO
      });
    },
    lead: function (origem) {
      track('Lead', {
        content_name: origem || 'Interesse Honra',
        currency: 'BRL',
        value: PRECO
      });
    },
    startTrial: function (eventId) {
      var id = eventId || gerarId('trial');
      track('CompleteRegistration', {
        content_name: 'Conta Honra',
        status: true,
        currency: 'BRL',
        value: PRECO
      }, id + '_reg');
      track('StartTrial', {
        content_name: 'Honra 7 dias gratis',
        predicted_ltv: Number((PRECO * 6).toFixed(2)),
        currency: 'BRL',
        value: PRECO
      }, id);
      return id;
    },
    initiateCheckout: function (eventId) {
      var id = eventId || gerarId('chk');
      track('InitiateCheckout', {
        content_name: 'Honra Mensal',
        num_items: 1,
        currency: 'BRL',
        value: PRECO
      }, id);
      return id;
    },
    subscribe: function (eventId) {
      var id = eventId || gerarId('sub');
      track('Subscribe', {
        content_name: 'Honra Mensal',
        predicted_ltv: Number((PRECO * 12).toFixed(2)),
        currency: 'BRL',
        value: PRECO
      }, id);
      return id;
    }
  });
})();
