// ==UserScript==
// @name         Auto select Expedition
// @namespace    http://tampermonkey.net/
// @version      2025-09-10
// @description  Auto-selects the “auto-expe” template, toggles the buttons, and reapplies after AJAX/SPA navigation.
// @author       Lord Syzona
// @match        https://*.ogame.gameforge.com/game/index.php?page=ingame&component=galaxy*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gameforge.com
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    // --- Debounce util ---
    const scheduleApply = (() => {
        let t = null;
        return (delay = 0) => {
            if (t) clearTimeout(t);
            t = setTimeout(() => {
                t = null;
                try { apply(); } catch (e) { /* ignore */ }
            }, delay);
        };
    })();

    const TARGET_LABEL = 'auto-expedition';

    function apply() {
        const sel = document.getElementById('expeditionFleetTemplateSelect');
        if (!sel) return false;

        // search option
        let opt =
            Array.from(sel.options).find((o) => o.textContent === TARGET_LABEL) ||
            Array.from(sel.options).find((o) => o.textContent.includes(TARGET_LABEL));

        if (!opt) return false;

        // Change option
        if (sel.value !== opt.value) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Toggle button
        const btnExp = document.getElementById('expeditionbutton');
        const btnSend = document.getElementById('sendExpeditionFleetTemplateFleet');

        if (btnExp && btnExp.style.display !== 'none') btnExp.style.display = 'none';
        if (btnSend) {
            if (btnSend.style.display === 'none') btnSend.style.display = '';
            btnSend.removeAttribute('disabled');
            btnSend.classList.remove('disabled');
        }

        return true;
    }

    // --- Hooks AJAX/SPA (patch uniques) ---
    if (!w.__AUTO_EXPE_PATCHED__) {
        w.__AUTO_EXPE_PATCHED__ = true;

        const _open = w.XMLHttpRequest && w.XMLHttpRequest.prototype.open;
        const _send = w.XMLHttpRequest && w.XMLHttpRequest.prototype.send;
        if (_open && _send) {
            w.XMLHttpRequest.prototype.open = function (...args) {
                try { this.__autoExpe_url = args[1]; } catch (_) {}
                return _open.apply(this, args);
            };
            w.XMLHttpRequest.prototype.send = function (...args) {
                try {
                    this.addEventListener('loadend', () => scheduleApply(0), { once: false });
                } catch (_) {}
                return _send.apply(this, args);
            };
        }


        if (w.fetch) {
            const _fetch = w.fetch.bind(w);
            w.fetch = function (...args) {
                const p = _fetch(...args);
                if (p && typeof p.finally === 'function') {
                    return p.finally(() => scheduleApply(0));
                }
                return p.then(
                    (res) => { scheduleApply(0); return res; },
                    (err) => { scheduleApply(0); throw err; }
                );
            };
        }


        const _push = w.history && w.history.pushState;
        const _replace = w.history && w.history.replaceState;
        if (_push) {
            w.history.pushState = function (...args) {
                const r = _push.apply(this, args);
                scheduleApply(0);
                return r;
            };
        }
        if (_replace) {
            w.history.replaceState = function (...args) {
                const r = _replace.apply(this, args);
                scheduleApply(0);
                return r;
            };
        }
        w.addEventListener('popstate', () => scheduleApply(0));
    }

    let obs = null;
    const startObserver = () => {
        if (obs) return;
        obs = new MutationObserver((mut) => {
            scheduleApply(50);
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
    };

    startObserver();
    document.addEventListener('DOMContentLoaded', () => scheduleApply(0));

    scheduleApply(0);
})();
