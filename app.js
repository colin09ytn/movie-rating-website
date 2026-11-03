/* Our Next Movie — Supabase-backed shared app. */
const SUPABASE_URL = "https://rekfxjwaxvriymeljysj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_EzL9fK_qAvH-a6LfarHlYQ_ftnHPf3p";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const PERSON_IDS = { a: "fbc4738f-b27c-49d2-8f58-6256899a898b", b: "40eb4c54-d663-451b-b35c-e4df91023ca8" };
const STORE_KEY = "our-next-movie-ui-v1";
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";
const state = {
  activeUser: "a",
  session: null,
  groupId: null,
  members: [],
  ready: false,
  view: "discover",
  currentId: null,
  candidateQueue: [],
  candidateIndex: 0,
  skippedIds: new Set(),
  tmdbToken: localStorage.getItem("df_tmdb_token") || "",
  accent: localStorage.getItem("df_accent") || "#e7a65b",
  data: loadData()
};
function freshData(){return {users:{a:{name:"Colin"},b:{name:"Erica"}},titles:[],ratings:{},settings:{}}}
function loadData(){return freshData()}
function persist(){renderAll(); queueRemoteSave().catch(e=>{console.error(e);showToast("Couldn't sync changes: "+(e.message||"check your connection"))})}
let saveQueue = Promise.resolve();
function queueRemoteSave(){ saveQueue = saveQueue.then(saveCurrentData); return saveQueue; }
function currentUserId(){return state.session?.user?.id || null}
function roleForUser(id){return id===PERSON_IDS.a?"a":id===PERSON_IDS.b?"b":null}
function dbError(error){if(error)throw error}
async function saveCurrentData(){
  if(!state.session||!state.groupId)return;
  const uid=currentUserId();
  for(const t of state.data.titles){
    const row={id:t.id,group_id:state.groupId,tmdb_id:t.tmdbId?Number(t.tmdbId):null,title:t.title,overview:t.overview||"",poster_path:t.posterPath||"",custom_poster_url:t.customPoster||null,release_date:t.year?(t.year+"-01-01"):null,added_by:uid,year:t.year||"",genres:t.genres||[],source:t.source||"manual"};
    const {error}=await supabaseClient.from("titles").upsert(row,{onConflict:"id"}); dbError(error);
  }
  const role=state.activeUser;
  for(const [titleId,byUser] of Object.entries(state.data.ratings)){
    const r=byUser?.[role]; if(!r)continue;
    const {error}=await supabaseClient.from("ratings").upsert({group_id:state.groupId,title_id:titleId,user_id:uid,own_rating:r.own,partner_rating:r.partner,updated_at:r.updatedAt||new Date().toISOString()},{onConflict:"title_id,user_id"}); dbError(error);
  }
}
async function loadSharedData(){
  const uid=currentUserId();
  const {data:members,error:memberError}=await supabaseClient.from("group_members").select("group_id,user_id,display_name").eq("user_id",uid);
  dbError(memberError);
  if(!members?.length)throw new Error("This account is not assigned to the shared movie group. Check group_members in Supabase.");
  state.groupId=members[0].group_id;
  const {data:allMembers,error:allMemberError}=await supabaseClient.from("group_members").select("group_id,user_id,display_name").eq("group_id",state.groupId);
  dbError(allMemberError); state.members=allMembers||[];
  const role=roleForUser(uid); if(!role)throw new Error("This login isn't one of the two configured movie-night accounts."); state.activeUser=role;
  const names={a:"Colin",b:"Erica"};
  state.members.forEach(m=>{const r=roleForUser(m.user_id);if(r)names[r]=m.display_name||names[r]});
  const [{data:titles,error:titlesError},{data:ratings,error:ratingsError}] = await Promise.all([
    supabaseClient.from("titles").select("*").eq("group_id",state.groupId).order("created_at",{ascending:false}),
    supabaseClient.from("ratings").select("*").eq("group_id",state.groupId)
  ]);
  dbError(titlesError); dbError(ratingsError);
  const mappedTitles=(titles||[]).map(t=>({id:t.id,title:t.title,type:t.source==="tmdb-tv"?"tv":(t.release_date&&t.source==="tv"?"tv":"movie"),tmdbId:t.tmdb_id,overview:t.overview||"",posterPath:t.poster_path||"",customPoster:t.custom_poster_url||"",year:t.year||(t.release_date||"").slice(0,4),genres:Array.isArray(t.genres)?t.genres:[],addedAt:t.created_at,source:t.source||"manual"}));
  const ratingMap={}; (ratings||[]).forEach(r=>{const role=roleForUser(r.user_id);if(!role)return;ratingMap[r.title_id]=ratingMap[r.title_id]||{};ratingMap[r.title_id][role]={own:Number(r.own_rating),partner:Number(r.partner_rating),updatedAt:r.updated_at}});
  state.data={users:{a:{name:names.a},b:{name:names.b}},titles:mappedTitles,ratings:ratingMap,settings:{}};
  state.ready=true; document.getElementById("auth-screen").hidden=true;document.getElementById("app-shell").hidden=false;
  if(state.liveChannel){supabaseClient.removeChannel(state.liveChannel);state.liveChannel=null;}
  state.liveChannel=supabaseClient.channel("onm-group-"+state.groupId).on("postgres_changes",{event:"*",schema:"public",table:"titles",filter:"group_id=eq."+state.groupId},()=>refreshSharedData()).on("postgres_changes",{event:"*",schema:"public",table:"ratings",filter:"group_id=eq."+state.groupId},()=>refreshSharedData()).subscribe();
  const who=document.getElementById("account-label");if(who)who.textContent=names[role]+" · Signed in";
  renderAll();
}
let refreshTimer=null;
function refreshSharedData(){if(refreshTimer)clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{if(!state.session||!state.groupId)return;try{await loadSharedData()}catch(e){console.warn("Realtime refresh failed",e)}},450)}
async function startApp(){
  const {data:{session},error}=await supabaseClient.auth.getSession();if(error)console.error(error);
  state.session=session;
  if(!session){document.getElementById("auth-screen").hidden=false;document.getElementById("app-shell").hidden=true;return}
  try{await loadSharedData()}catch(e){document.getElementById("auth-error").textContent=e.message;document.getElementById("auth-screen").hidden=false;document.getElementById("app-shell").hidden=true;}
}

function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function titleId(t){return crypto.randomUUID()}
function ratingFor(id,user=state.activeUser){return state.data.ratings[id]?.[user]||null}
function bothRated(t){return !!(state.data.ratings[t.id]?.a&&state.data.ratings[t.id]?.b)}
function combinedScore(t){const a=ratingFor(t.id,"a"),b=ratingFor(t.id,"b");if(!a||!b)return null;return a.own*b.own+a.partner*b.partner}
function hasRated(t){return !!ratingFor(t.id,"a")||!!ratingFor(t.id,"b")}
function hasActiveUserRated(t){return !!ratingFor(t.id,state.activeUser)}
function poster(t){return t.customPoster||t.posterPath?(t.customPoster||TMDB_IMAGE+t.posterPath):""}
function imgHtml(t,cls=""){const src=poster(t);return src?`<img class="${cls}" src="${esc(src)}" alt="Poster for ${esc(t.title)}" onerror="this.style.display='none'">`:`<div class="${cls} poster-placeholder">ONM<span>NO POSTER</span></div>`}
function showToast(message){const el=document.getElementById("toast");el.textContent=message;el.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.remove("show"),2600)}
function setView(view){state.view=view;document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));const titles={discover:"Discover",watchlist:"Top picks",history:"Rating history",settings:"Settings"};document.getElementById("page-title").textContent=titles[view];renderAll();window.scrollTo({top:0,behavior:"smooth"})}
function renderAll(){renderUserSelect();renderStats();renderRecommendation();renderWatchlist();renderHistory();renderSettings()}
function renderUserSelect(){const sel=document.getElementById("active-user");if(sel){sel.innerHTML=`<option value="${state.activeUser}">${esc(state.data.users[state.activeUser].name)}</option>`;sel.disabled=true;}}
function renderStats(){const complete=state.data.titles.filter(bothRated);document.getElementById("rated-count").textContent=state.data.titles.filter(hasRated).length;document.getElementById("mutual-count").textContent=complete.length;const top=complete.map(t=>combinedScore(t)).sort((a,b)=>b-a)[0];document.getElementById("best-score").textContent=top==null?"—":top}
function topTitle(){return state.data.titles.filter(bothRated).sort((a,b)=>combinedScore(b)-combinedScore(a))[0]||null}
function currentCandidate(){if(state.currentId){const t=state.data.titles.find(t=>t.id===state.currentId);if(t&&!hasActiveUserRated(t)&&!state.skippedIds.has(t.id))return t;}return state.data.titles.find(t=>!hasActiveUserRated(t)&&!state.skippedIds.has(t.id))||null}
function renderRecommendation(){const t=currentCandidate();const el=document.getElementById("recommendation-card");if(!t){el.innerHTML=`<div class="poster-wrap"><div class="poster-placeholder">ONM<span>NO POSTER</span></div></div><div class="recommendation-info"><h3>No unrated titles</h3><p>Find another suggestion or add a title.</p><div class="card-actions"><button class="button button-primary" onclick="nextCandidate()">Find another</button><button class="button button-outline" onclick="openAddDialog()">Add a title</button></div></div>`;return}const score=combinedScore(t);const genres=(t.genres||[]).slice(0,3).map(g=>`<span class="genre-tag">${esc(g)}</span>`).join("");el.innerHTML=`<div class="poster-wrap">${imgHtml(t)}</div><div class="recommendation-info"><h3>${esc(t.title)} ${t.year?`<span style="font-size:14px;color:var(--muted);font-weight:400">(${esc(t.year)})</span>`:""}</h3><div class="meta-row"><span>${t.type==="tv"?"TV series":"Movie"}</span>${genres}${score!==null?`<span class="score-chip">Shared score ${score}/200</span>`:""}</div><p>${esc(t.overview||"")}</p><div class="card-actions"><button class="button button-primary" onclick="openRating('${t.id}')">${hasActiveUserRated(t)?"Edit my rating":"Rate this title"}</button><button class="button button-outline" onclick="openDetails('${t.id}')">Details</button><button class="button button-quiet" onclick="nextCandidate()">Skip</button></div></div>`}
function renderWatchlist(){const el=document.getElementById("watchlist-list");const items=state.data.titles.filter(bothRated).sort((a,b)=>combinedScore(b)-combinedScore(a));if(!items.length){el.innerHTML='<div class="empty-state" style="grid-column:1/-1"><strong>No shared scores yet</strong>Once both people rate the same title, it will appear here, ranked by your formula.</div>';return}el.innerHTML=items.map(t=>`<article class="title-card">${imgHtml(t,"title-poster")}<div class="title-card-body"><h3>${esc(t.title)}</h3><p>${esc(t.year||"")} · ${t.type==="tv"?"TV show":"Movie"}</p><span class="score-chip">${combinedScore(t)} / 200</span><button class="button button-outline" onclick="openDetails('${t.id}')">View ratings</button></div></article>`).join("")}
function renderHistory(){const el=document.getElementById("history-list");const items=[...state.data.titles].filter(hasRated).sort((a,b)=>Number(bothRated(a))-Number(bothRated(b)));if(!items.length){el.innerHTML='<div class="empty-state"><strong>Your rating history is empty</strong>Rate a title and it will be recorded here.</div>';return}el.innerHTML=items.map(t=>`<article class="history-row">${imgHtml(t)}<div class="history-info"><h3>${esc(t.title)}</h3><p>${state.data.ratings[t.id]?.a?`${esc(state.data.users.a.name)} rated ${state.data.ratings[t.id].a.own}/10`:"Waiting for "+esc(state.data.users.a.name)} · ${state.data.ratings[t.id]?.b?`${esc(state.data.users.b.name)} rated ${state.data.ratings[t.id].b.own}/10`:"Waiting for "+esc(state.data.users.b.name)}</p></div><span class="status ${bothRated(t)?"complete":""}">${bothRated(t)?`Score ${combinedScore(t)}/200`:"Needs second vote"}</span><button class="button button-quiet" onclick="openDetails('${t.id}')">Details</button></article>`).join("")}
function renderSettings(){document.getElementById("tmdb-key").value=state.tmdbToken;document.getElementById("name-a").value=state.data.users.a.name;document.getElementById("name-b").value=state.data.users.b.name;document.querySelectorAll(".swatch").forEach(b=>b.classList.toggle("selected",b.dataset.color===state.accent));document.documentElement.style.setProperty("--accent",state.accent);}
function openRating(id){const t=state.data.titles.find(x=>x.id===id);if(!t)return;state.currentId=id;const r=ratingFor(id)||{own:5,partner:5};const existing=!!ratingFor(id);document.getElementById("rating-content").innerHTML=`<div class="rating-layout">${imgHtml(t,"rating-poster")}<div class="rating-details"><span class="eyebrow">YOUR TAKE</span><h2>${esc(t.title)}</h2><div class="meta-row">${esc(t.year||"")} · ${t.type==="tv"?"TV show":"Movie"}</div><p>${esc(t.overview||"No synopsis available.")}</p><div class="rating-field"><div class="rating-field-head"><span>How much do you want to watch it?</span><span class="rating-value" id="own-value">${r.own}/10</span></div><input id="own-rating" type="range" min="0" max="10" step="1" value="${r.own}"><div class="range-ends"><span>Not interested</span><span>Very interested</span></div></div><div class="rating-field"><div class="rating-field-head"><span>How much do you think ${esc(state.data.users[state.activeUser==="a"?"b":"a"].name)} wants to watch it?</span><span class="rating-value" id="partner-value">${r.partner}/10</span></div><input id="partner-rating" type="range" min="0" max="10" step="1" value="${r.partner}"><div class="range-ends"><span>Not interested</span><span>Very interested</span></div></div><div class="rating-footer"><button class="button button-outline" onclick="document.getElementById('rating-dialog').close()">Cancel</button><button class="button button-primary" id="save-rating">${existing?"Update my rating":"Save my rating"}</button></div></div></div>`;
document.getElementById("own-rating").addEventListener("input",e=>document.getElementById("own-value").textContent=e.target.value+"/10");document.getElementById("partner-rating").addEventListener("input",e=>document.getElementById("partner-value").textContent=e.target.value+"/10");document.getElementById("save-rating").addEventListener("click",()=>{state.data.ratings[id]=state.data.ratings[id]||{};state.data.ratings[id][state.activeUser]={own:Number(document.getElementById("own-rating").value),partner:Number(document.getElementById("partner-rating").value),updatedAt:new Date().toISOString()};document.getElementById("rating-dialog").close();persist();showToast(bothRated(t)?"Both votes are in — shared score updated.":"Rating saved and syncing.");});document.getElementById("rating-dialog").showModal()}
function openDetails(id){const t=state.data.titles.find(x=>x.id===id);if(!t)return;state.currentId=id;document.getElementById("rating-content").innerHTML=`<div class="rating-layout">${imgHtml(t,"rating-poster")}<div class="rating-details"><span class="eyebrow">TITLE DETAILS</span><h2>${esc(t.title)}</h2><div class="meta-row">${esc(t.year||"")} · ${t.type==="tv"?"TV show":"Movie"} ${bothRated(t)?`· Shared score ${combinedScore(t)}/200`:""}</div><p>${esc(t.overview||"No synopsis available.")}</p><div class="rating-field"><strong style="font-size:12px">Ratings so far</strong><p>${["a","b"].map(u=>state.data.ratings[id]?.[u]?`${esc(state.data.users[u].name)}: own ${state.data.ratings[id][u].own}/10, partner estimate ${state.data.ratings[id][u].partner}/10`:`${esc(state.data.users[u].name)} has not rated yet`).join("<br>")}</p></div><label for="custom-poster-file">Upload custom poster</label><input id="custom-poster-file" type="file" accept="image/*"><div class="rating-footer"><button class="button button-outline" onclick="removeTitle('${id}')">Remove title</button><button class="button button-primary" onclick="document.getElementById('rating-dialog').close();openRating('${id}')">Rate this title</button></div></div></div>`;
document.getElementById("custom-poster-file").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;if(f.size>2*1024*1024){showToast("Please use an image under 2 MB.");return}const data=await fileToDataURL(f);t.customPoster=data;persist();openDetails(id);showToast("Custom poster updated.");});document.getElementById("rating-dialog").showModal()}
function removeTitle(id){if(!confirm("Remove this title and its ratings from this browser?"))return;state.data.titles=state.data.titles.filter(t=>t.id!==id);delete state.data.ratings[id];document.getElementById("rating-dialog").close();persist();showToast("Title removed.")}
function nextCandidate(){
  // Mark the current suggestion as skipped so it cannot be selected again immediately.
  if(state.currentId)state.skippedIds.add(state.currentId);
  state.currentId=null;
  const unrated=state.data.titles.filter(t=>!hasActiveUserRated(t)&&!state.skippedIds.has(t.id));
  if(unrated.length){state.currentId=unrated[Math.floor(Math.random()*unrated.length)].id;renderRecommendation();return}
  if(state.tmdbToken){recommendFromTMDB().catch(e=>showToast(e.message||"Could not load recommendations."));return}
  renderRecommendation();
  showToast("No more titles to skip. Add a title or connect TMDB.");
}
function openAddDialog(){document.getElementById("search-results").innerHTML="";document.getElementById("title-search").value="";document.getElementById("add-dialog").showModal()}
function fileToDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
function addTitle(raw){const existing=state.data.titles.find(t=>(raw.tmdbId&&String(t.tmdbId)===String(raw.tmdbId)&&t.type===raw.type)||(!raw.tmdbId&&t.title.toLowerCase()===raw.title.toLowerCase()));if(existing){state.currentId=existing.id;showToast(hasActiveUserRated(existing)?"You have already rated this title.":"This title is already in your list — ready for your rating.");return existing}const t={id:titleId(raw),title:raw.title,type:raw.type||"movie",tmdbId:raw.tmdbId||null,overview:raw.overview||"",posterPath:raw.posterPath||"",customPoster:raw.customPoster||"",year:raw.year||"",genres:raw.genres||[],addedAt:new Date().toISOString(),source:raw.type==="tv"?"tmdb-tv":(raw.source||"manual")};state.data.titles.unshift(t);state.currentId=t.id;persist();return t}
async function tmdbFetch(path,params={}){if(!state.tmdbToken)throw new Error("Add your TMDB API Read Access Token in Settings first.");const url=new URL("https://api.themoviedb.org/3"+path);Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")url.searchParams.set(k,v)});const res=await fetch(url,{headers:{Authorization:"Bearer "+state.tmdbToken,accept:"application/json"}});if(!res.ok){let msg=`TMDB returned ${res.status}`;try{const d=await res.json();if(d.status_message)msg=d.status_message}catch(e){}throw new Error(msg)}return res.json()}
function fromTMDB(r,type){return {title:r.title||r.name||"Untitled",type,tmdbId:r.id,overview:r.overview||"",posterPath:r.poster_path||"",year:(r.release_date||r.first_air_date||"").slice(0,4),genres:[],source:"tmdb"}}
async function searchTMDB(){const q=document.getElementById("title-search").value.trim();if(!q)return;const results=document.getElementById("search-results");results.innerHTML='<p class="muted">Searching TMDB…</p>';try{const data=await tmdbFetch("/search/multi",{query:q,include_adult:false});const items=(data.results||[]).filter(r=>["movie","tv"].includes(r.media_type)).slice(0,8);results.innerHTML=items.length?items.map((r,i)=>{const t=fromTMDB(r,r.media_type);return `<div class="search-result">${t.posterPath?`<img src="${TMDB_IMAGE+t.posterPath}" alt="">`:'<div style="width:38px;height:55px;background:#e5e1d6"></div>'}<div><strong>${esc(t.title)}</strong><small>${esc(t.year)} · ${t.type==="tv"?"TV show":"Movie"}</small></div><button class="button button-outline" data-result="${i}">Add</button></div>`}).join(""):'<p class="muted">No matching titles found.</p>';results.querySelectorAll("[data-result]").forEach((b,i)=>b.addEventListener("click",()=>{const r=items[i];const t=fromTMDB(r,r.media_type);const selected=addTitle(t);document.getElementById("add-dialog").close();renderAll();if(hasActiveUserRated(selected)){openRating(selected.id)}else{showToast("Ready to rate "+selected.title+".")};}))}catch(e){results.innerHTML=`<p class="muted">${esc(e.message)}</p>`}}
async function recommendFromTMDB(){
  showToast("Finding a mix of picks…");
  try{
    const seen=new Set(state.data.titles.filter(t=>t.tmdbId).map(t=>`${t.type}-${t.tmdbId}`));
    const pool=new Map();
    const addCandidate=(raw,type,source,bonus=0)=>{
      if(!raw||!raw.id||!raw.poster_path||!raw.overview)return;
      const key=`${type}-${raw.id}`;
      if(seen.has(key))return;
      const item=pool.get(key)||{raw,type,sources:new Set(),bonus:0};
      item.sources.add(source);item.bonus=Math.max(item.bonus,bonus);pool.set(key,item);
    };
    const safeFetch=async(path,params={})=>{try{return await tmdbFetch(path,params)}catch(e){console.warn("Skipped recommendation source",path,e.message);return {results:[]}}};
    const requests=[
      safeFetch("/trending/all/week"),
      safeFetch("/discover/movie",{sort_by:"vote_average.desc", "vote_count.gte":150, include_adult:false, page:1}),
      safeFetch("/discover/tv",{sort_by:"vote_average.desc", "vote_count.gte":100, include_adult:false, page:1}),
      safeFetch("/discover/movie",{sort_by:"popularity.desc", include_adult:false, page:1}),
      safeFetch("/discover/tv",{sort_by:"popularity.desc", include_adult:false, page:1})
    ];
    // Use high-interest picks from both people as seeds, but keep the pool broader than similar-title results.
    const seeds=state.data.titles
      .filter(t=>t.tmdbId&&hasRated(t))
      .map(t=>({t,score:(ratingFor(t.id,"a")?.own||0)+(ratingFor(t.id,"b")?.own||0)}))
      .sort((a,b)=>b.score-a.score).slice(0,3);
    for(const seed of seeds){
      const path=seed.t.type==="tv"?`/tv/${seed.t.tmdbId}/recommendations`:`/movie/${seed.t.tmdbId}/recommendations`;
      requests.push(safeFetch(path,{page:1}).then(data=>({...data,_source:"similar"})).catch(()=>({results:[],_source:"similar"})));
    }
    const results=await Promise.all(requests);
    results.forEach((data,index)=>{
      const source=index===0?"trending":index===1||index===2?"top-rated":index===3||index===4?"popular":"similar";
      (data.results||[]).forEach(r=>{
        const type=r.media_type||((index===2||index===4)?"tv":(index>=5?seeds[index-5]?.t.type:"movie"));
        if(type==="movie"||type==="tv")addCandidate(r,type,source,source==="similar"?1:0);
      });
    });
    let candidates=[...pool.values()].map(c=>{
      const votes=Number(c.raw.vote_count)||0;
      const rating=Number(c.raw.vote_average)||0;
      const popularity=Number(c.raw.popularity)||0;
      const score=rating*1.7+Math.log10(votes+1)*1.5+Math.log10(popularity+1)*0.7+c.bonus+c.sources.size*0.7;
      return {...c,score};
    }).sort((a,b)=>b.score-a.score);
    if(!candidates.length)throw new Error("No new titles found. Try searching for a movie or show.");
    // Randomize among a strong shortlist to avoid repeatedly picking the same franchise or source.
    const shortlist=candidates.slice(0,Math.min(24,candidates.length));
    const chosen=shortlist[Math.floor(Math.random()*shortlist.length)];
    const t=addTitle(fromTMDB(chosen.raw,chosen.type));
    renderAll();
    showToast("Suggested "+t.title+".");
    return t;
  }catch(e){showToast(e.message||"Recommendation request failed.");throw e}
}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));

document.getElementById("refresh-recs").addEventListener("click",()=>nextCandidate());
document.getElementById("manual-add").addEventListener("click",openAddDialog);
document.getElementById("search-tmdb").addEventListener("click",searchTMDB);
document.getElementById("title-search").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchTMDB()}});
document.getElementById("create-manual").addEventListener("click",async()=>{const title=document.getElementById("manual-title").value.trim();if(!title){showToast("Enter a title first.");return}const f=document.getElementById("manual-image").files[0];if(f&&f.size>2*1024*1024){showToast("Please use an image under 2 MB.");return}const customPoster=f?await fileToDataURL(f):"";const t=addTitle({title,type:document.getElementById("manual-type").value,overview:document.getElementById("manual-overview").value.trim(),customPoster,source:"manual"});document.getElementById("add-dialog").close();renderAll();showToast("Added "+t.title+".")});
document.getElementById("save-key").addEventListener("click",()=>{state.tmdbToken=document.getElementById("tmdb-key").value.trim();localStorage.setItem("df_tmdb_token",state.tmdbToken);showToast("TMDB token saved in this browser.");});
document.getElementById("save-names").addEventListener("click",()=>showToast("Account names are managed in the shared Supabase group."));
document.querySelectorAll(".swatch").forEach(b=>b.addEventListener("click",()=>{state.accent=b.dataset.color;localStorage.setItem("df_accent",state.accent);renderSettings()}));
document.getElementById("export-data").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state.data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="our-next-movie-backup.json";a.click();URL.revokeObjectURL(a.href)});
document.getElementById("import-data").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d.users||!Array.isArray(d.titles)||!d.ratings)throw new Error("This doesn't look like a Double Feature backup.");state.data=d;persist();showToast("Backup imported.");}catch(err){showToast(err.message||"Could not import backup.")}e.target.value=""});
document.getElementById("reset-data").addEventListener("click",async()=>{if(!confirm("Delete every movie and rating from the shared group for both people? This cannot be undone. Continue?"))return;try{const {error}=await supabaseClient.from("titles").delete().eq("group_id",state.groupId);dbError(error);state.data=freshData();state.currentId=null;renderAll();showToast("Shared movie list cleared.")}catch(e){showToast("Reset failed: "+e.message)}});
window.openAddDialog=openAddDialog;window.openRating=openRating;window.openDetails=openDetails;window.removeTitle=removeTitle;window.setView=setView;window.nextCandidate=nextCandidate;
renderAll();

// Auth controls and persistent-session bootstrap.
document.getElementById("login-form").addEventListener("submit",async e=>{e.preventDefault();const email=document.getElementById("login-email").value.trim();const password=document.getElementById("login-password").value;const button=document.getElementById("login-submit");button.disabled=true;document.getElementById("auth-error").textContent="Signing in…";try{const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});dbError(error);state.session=data.session;document.getElementById("auth-error").textContent="";await loadSharedData()}catch(err){document.getElementById("auth-error").textContent=err.message||"Unable to sign in."}finally{button.disabled=false}});
document.getElementById("logout-button").addEventListener("click",async()=>{const {error}=await supabaseClient.auth.signOut();if(error){showToast(error.message);return}state.session=null;state.groupId=null;state.ready=false;state.data=freshData();document.getElementById("app-shell").hidden=true;document.getElementById("auth-screen").hidden=false;document.getElementById("login-password").value="";document.getElementById("auth-error").textContent="Signed out."});
supabaseClient.auth.onAuthStateChange((_event,session)=>{state.session=session;if(!session){document.getElementById("auth-screen").hidden=false;document.getElementById("app-shell").hidden=true}});
startApp();
