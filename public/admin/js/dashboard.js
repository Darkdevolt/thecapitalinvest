/* ══════════════════════════════════════════════════════
   DASHBOARD — ALERTES PRÉCISES (remplace loadDashboardAlerts)
══════════════════════════════════════════════════════ */

async function loadDashboardAlerts() {
    const panel = document.getElementById('dash-alerts');
    if(!panel) return;

    // Appel RPC Supabase (POST /rest/v1/rpc/get_aberrations)
    let aberrations = [];
    try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_aberrations`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ limit_per_type: 10 })
        });
        if (resp.ok) aberrations = await resp.json();
    } catch(e) {
        console.error('Erreur RPC get_aberrations:', e);
    }

    if (!aberrations || aberrations.length === 0) {
        panel.innerHTML = '<div style="color:var(--green);font-size:13px;padding:12px 0;">✓ Aucune anomalie détectée. Base propre.</div>';
        return;
    }

    // Compteurs globaux
    const errs = aberrations.filter(a => a.severity === 'err').length;
    const warns = aberrations.filter(a => a.severity === 'warn').length;

    let html = `<div style="display:flex;gap:20px;margin-bottom:16px;font-size:12px;font-weight:600;">
        <span style="color:var(--red);">● ${errs} CRITIQUES</span>
        <span style="color:var(--orange);">● ${warns} AVERTISSEMENTS</span>
        <span style="color:var(--muted);margin-left:auto;">${aberrations.length} lignes concernées</span>
    </div>`;

    // Groupe par type d'anomalie
    const byType = {};
    aberrations.forEach(a => {
        if (!byType[a.anomalie_type]) byType[a.anomalie_type] = [];
        byType[a.anomalie_type].push(a);
    });

    for (const [type, items] of Object.entries(byType)) {
        const isErr = items[0].severity === 'err';
        const color = isErr ? 'var(--red)' : 'var(--orange)';
        const bg = isErr ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.08)';

        html += `<div style="margin-bottom:20px;border:1px solid var(--border-s);border-radius:8px;overflow:hidden;">
            <div style="background:${bg};padding:10px 14px;font-weight:600;font-size:13px;color:${color};display:flex;justify-content:space-between;align-items:center;">
                <span>${type}</span>
                <span style="font-size:11px;opacity:0.8;background:rgba(0,0,0,0.2);padding:2px 8px;border-radius:4px;">${items.length} ligne(s)</span>
            </div>
            <div style="padding:8px 14px;">`;

        // Header tableau
        html += `<div style="display:grid;grid-template-columns:70px 90px 110px 1fr 90px;gap:10px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);border-bottom:1px solid var(--border-s);padding:4px 0;font-weight:600;">
            <div>Ticker</div>
            <div>Date</div>
            <div>Valeur actuelle</div>
            <div>Détail / Attendu</div>
            <div>Source</div>
        </div>`;

        // Lignes
        items.forEach(item => {
            html += `<div style="display:grid;grid-template-columns:70px 90px 110px 1fr 90px;gap:10px;font-size:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03);align-items:center;">
                <div><strong style="color:${color};">${item.ticker}</strong></div>
                <div style="font-family:monospace;font-size:11px;">${item.date_seance}</div>
                <div style="font-family:monospace;color:${color};">${item.valeur_actuelle}</div>
                <div style="color:var(--muted);font-size:11px;">${item.valeur_attendue}</div>
                <div><span style="background:rgba(255,255,255,0.05);padding:3px 8px;border-radius:4px;font-size:10px;text-transform:uppercase;">${item.source_table}</span></div>
            </div>`;
        });

        // Lien vers correction
        const targetPanel = items[0].source_table === 'historique' ? 'historique' : 'cours';
        html += `<div style="padding-top:8px;font-size:11px;">
            <a href="#" onclick="showPanel('${targetPanel}');return false;" style="color:var(--accent);text-decoration:none;">
                → Voir toutes les lignes dans le panel ${targetPanel}
            </a>
        </div>`;

        html += `</div></div>`;
    }

    panel.innerHTML = html;
}
