/* ── RAFRAÎCHISSEMENT TOKEN SUPABASE ─────────────────────────── */
async function refreshSession() {
    const raw = localStorage.getItem(SK);
    if (!raw) return false;
    let sess;
    try { sess = JSON.parse(raw); } catch(e) { return false; }
    const refresh = sess && sess.data && sess.data.session && sess.data.session.refresh_token ? sess.data.session.refresh_token : (sess && sess.session && sess.session.refresh_token ? sess.session.refresh_token : (sess && sess.refresh_token ? sess.refresh_token : ''));
    if (!refresh) return false;
    try {
        const r = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: SB_ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }) });
        const data = await r.json();
        if (!r.ok || !data.access_token) return false;
        if (sess.data && sess.data.session) { sess.data.session.access_token=data.access_token; sess.data.session.refresh_token=data.refresh_token; sess.data.session.expires_at=data.expires_at; if(data.user)sess.data.user=data.user; }
        else if (sess.session) { sess.session.access_token=data.access_token; sess.session.refresh_token=data.refresh_token; sess.session.expires_at=data.expires_at; if(data.user)sess.user=data.user; }
        else { sess.access_token=data.access_token; sess.refresh_token=data.refresh_token; sess.expires_at=data.expires_at; }
        localStorage.setItem(SK, JSON.stringify(sess)); TK=data.access_token; return true;
    } catch(e) { return false; }
}
async function ensureAuth() { const raw=localStorage.getItem(SK); if(!raw)return false; let sess; try{sess=JSON.parse(raw);}catch(e){return false;} const session=sess&&sess.data&&sess.data.session?sess.data.session:(sess&&sess.session?sess.session:sess); const expiresAt=session&&session.expires_at?session.expires_at:null; if(expiresAt&&(Date.now()/1000)>(expiresAt-120))return await refreshSession(); return true; }
function sbHeaders(extra) { var base={apikey:SB_ANON,Authorization:'Bearer '+TK,'Content-Type':'application/json',Prefer:'return=representation'}; if(extra)for(var k in extra)base[k]=extra[k]; return base; }
async function sbGet(table,params){try{const url=SB_REST+'/'+table+(params?'?'+params:'');const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),10000);const r=await fetch(url,{headers:sbHeaders(),signal:ctrl.signal});clearTimeout(t);if(!r.ok){const e=await r.json().catch(()=>({}));toast((e&&e.message||'Erreur lecture')+' ['+table+']','err');return null;}return r.json();}catch(e){if(e.name!=='AbortError')toast('Réseau: '+e.message,'err');return null;}}
async function sbCount(table,params){try{const clean=params?String(params).replace(/select=[^&]*/g,'').replace(/^&|&$/g,''):'';const url=SB_REST+'/'+table+'?select=*&limit=0'+(clean?'&'+clean:'');const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),8000);const r=await fetch(url,{headers:Object.assign({},sbHeaders(),{Prefer:'count=exact',Range:'0-0'}),signal:ctrl.signal});clearTimeout(t);if(!r.ok)return 0;const range=r.headers.get('content-range');return parseInt(range?range.split('/')[1]:'0')||0;}catch(e){return 0;}}

/* Normalisation stricte des données importées avant envoi à PostgREST. */
function normalizeNumeric(v) {
    if(v===null||v===undefined||v==='') return null;
    if(typeof v==='number') return Number.isFinite(v)?v:null;
    var s=String(v).trim().replace(/\u00a0/g,' ').replace(/\s+/g,'');
    s=s.replace(/%$/,'');
    /* Supporte 1 234,56 / 1.234,56 / 1,234.56 / 1234.56 et symboles monétaires. */
    s=s.replace(/(?:FCFA|XOF|F CFA|CFA|€|\$)/gi,'');
    if(s.indexOf(',')>=0&&s.indexOf('.')>=0){ if(s.lastIndexOf(',')>s.lastIndexOf('.')) s=s.replace(/\./g,'').replace(',','.'); else s=s.replace(/,/g,''); }
    else if(s.indexOf(',')>=0) s=s.replace(',','.');
    var n=Number(s); return Number.isFinite(n)?n:null;
}
function normalizeDividendPayload(body){
    var arr=Array.isArray(body)?body:[body];
    arr=arr.map(function(x){
        var o=Object.assign({},x);
        ['annee','montant','taux_rendement'].forEach(function(k){ if(o[k]!==undefined) o[k]=normalizeNumeric(o[k]); });
        if(o.annee!==null&&o.annee!==undefined) o.annee=Math.trunc(Number(o.annee));
        if(o.exercice!==undefined&&o.exercice!==null&&o.exercice!=='') {
            var ex=String(o.exercice).trim();
            var exNum=normalizeNumeric(ex);
            o.exercice=exNum!==null?String(Math.trunc(exNum)):ex;
        } else if(o.annee!==null&&o.annee!==undefined) o.exercice=String(o.annee);
        ['date_detachement','date_paiement'].forEach(function(k){
            if(o[k]!==undefined&&o[k]!==null&&o[k]!==''){
                var d=String(o[k]).trim();
                if(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(d)){var p=d.split(/[\/-]/),a=+p[0],b=+p[1],y=+p[2];if(y<100)y+=y<50?2000:1900;if(a<=12&&b>12){var z=a;a=b;b=z;}o[k]=y+'-'+String(b).padStart(2,'0')+'-'+String(a).padStart(2,'0');}
            }
        });
        return o;
    });
    return Array.isArray(body)?arr:arr[0];
}

async function sbPost(table,body,onConflict){
    try{
        var prefer=onConflict?'return=representation,resolution=merge-duplicates':'return=representation';
        var url=onConflict?SB_REST+'/'+table+'?on_conflict='+onConflict:SB_REST+'/'+table;
        if(table==='dividendes_calendrier') body=normalizeDividendPayload(body);
        const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),15000);
        const r=await fetch(url,{method:'POST',headers:sbHeaders({Prefer:prefer}),body:JSON.stringify(body),signal:ctrl.signal});clearTimeout(t);
        if(!r.ok){
            const e=await r.json().catch(()=>({}));
            var raw=e&&e.message||e&&e.details||e&&e.hint||JSON.stringify(e);
            if(/foreign key/i.test(raw)){var tl=body&&body.ticker?' "'+body.ticker+'"':'';raw='⚠️ Ticker'+tl+' inexistant — créez-le d’abord dans l’onglet Entreprises.';}
            else if(/duplicate|unique/i.test(raw)){var tl2=body&&body.ticker?' pour '+body.ticker:'';raw='⚠️ Entrée déjà existante'+tl2+' — utilisez ✎ pour modifier.';}
            else if(/null value|not-null/i.test(raw))raw='⚠️ Champ obligatoire vide — vérifiez les colonnes du template.';
            else if(/invalid input syntax|numeric|integer|date/i.test(raw)){
                var detail=String(e&&e.message||raw).replace(/\s+/g,' ').slice(0,220);
                raw='⚠️ Valeur invalide dans le fichier. Vérifiez les colonnes numériques/dates. Détail : '+detail;
            }
            else if(/permission|policy/i.test(raw))raw='⚠️ Accès refusé — vérifiez les permissions RLS dans Supabase.';
            else if(/relation.*does not exist/i.test(raw))raw='⚠️ Table introuvable dans Supabase.';
            else if(/too long/i.test(raw))raw='⚠️ Valeur trop longue dans un des champs.';
            if(/jwt|expired/i.test(String(raw))){const refreshed=await refreshSession();if(refreshed){const retry=await fetch(url,{method:'POST',headers:sbHeaders({Prefer:prefer}),body:JSON.stringify(body)});if(retry.ok)return retry.json();}}
            toast(raw+' ['+table+']','err');return null;
        }
        return r.json();
    }catch(e){if(e.name!=='AbortError')toast('Réseau: '+e.message,'err');return null;}
}
async function sbPatch(table,filter,body){try{const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),10000);const r=await fetch(SB_REST+'/'+table+'?'+filter,{method:'PATCH',headers:sbHeaders(),body:JSON.stringify(body),signal:ctrl.signal});clearTimeout(t);if(!r.ok){const e=await r.json().catch(()=>({}));var raw=e&&e.message||e&&e.details||'Erreur MAJ';if(/foreign key/i.test(raw))raw='⚠️ Référence invalide — le ticker lié n’existe pas.';else if(/duplicate|unique/i.test(raw))raw='⚠️ Doublon — cette entrée existe déjà.';else if(/null value/i.test(raw))raw='⚠️ Champ obligatoire vide.';else if(/permission|policy/i.test(raw))raw='⚠️ Accès refusé — vérifiez les permissions RLS.';else if(/jwt|expired/i.test(raw))raw='⚠️ Session expirée — reconnectez-vous.';toast(raw,'err');return null;}return r.json();}catch(e){if(e.name!=='AbortError')toast('Réseau: '+e.message,'err');return null;}}
async function sbDel(table,filter){try{const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),10000);const r=await fetch(SB_REST+'/'+table+'?'+filter,{method:'DELETE',headers:sbHeaders(),signal:ctrl.signal});clearTimeout(t);if(!r.ok){const e=await r.json().catch(()=>({}));var raw=e&&e.message||e&&e.details||'Erreur suppression';if(/foreign key/i.test(raw))raw='⚠️ Suppression impossible — d’autres données dépendent de cet élément.';else if(/permission|policy/i.test(raw))raw='⚠️ Accès refusé — vérifiez les permissions RLS.';else if(/jwt|expired/i.test(raw))raw='⚠️ Session expirée — reconnectez-vous.';toast(raw,'err');return false;}return true;}catch(e){if(e.name!=='AbortError')toast('Réseau: '+e.message,'err');return false;}}
