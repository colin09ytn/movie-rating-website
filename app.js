/* Double Feature — local prototype.
 * Local ratings live in localStorage and are NOT shared across devices.
 * For two-device use, connect Supabase Auth + database policies (see supabase/schema.sql).
 */
const STORE_KEY = "double-feature-v1";
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";
const state = {
  activeUser: "a",
  view: "discover",
  currentId: null,
  candidateQueue: [],
  candidateIndex: 0,
  skippedIds: new Set(),
  tmdbToken: localStorage.getItem("df_tmdb_token") || "",
  accent: localStorage.getItem("df_accent") || "#e7a65b",
  data: loadData()
};
function freshData(){return {users:{a:{name:"Alex"},b:{name:"Jamie"}},titles:[],ratings:{},settings:{}}}
function loadData(){try{const d=JSON.parse(localStorage.getItem(STORE_KEY));if(d&&d.users&&Array.isArray(d.titles)&&d.ratings)return d;}catch(e){}return freshData()}
function persist(){localStorage.setItem(STORE_KEY,JSON.stringify(state.data));renderAll()}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function titleId(t){return `${t.type||"movie"}-${t.tmdbId||"custom-"+Date.now()+"-"+Math.random().toString(36).slice(2,7)}`}
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
function renderUserSelect(){const sel=document.getElementById("active-user");sel.innerHTML=["a","b"].map(id=>`<option value="${id}" ${id===state.activeUser?"selected":""}>${esc(state.data.users[id].name)}</option>`).join("")}
function renderStats(){const complete=state.data.titles.filter(bothRated);document.getElementById("rated-count").textContent=state.data.titles.filter(hasRated).length;document.getElementById("mutual-count").textContent=complete.length;const top=complete.map(t=>combinedScore(t)).sort((a,b)=>b-a)[0];document.getElementById("best-score").textContent=top==null?"—":top}
function topTitle(){return state.data.titles.filter(bothRated).sort((a,b)=>combinedScore(b)-combinedScore(a))[0]||null}
function currentCandidate(){if(state.currentId){const t=state.data.titles.find(t=>t.id===state.currentId);if(t&&!hasActiveUserRated(t)&&!state.skippedIds.has(t.id))return t;}return state.data.titles.find(t=>!hasActiveUserRated(t)&&!state.skippedIds.has(t.id))||null}
function renderRecommendation(){const t=currentCandidate();const el=document.getElementById("recommendation-card");if(!t){el.innerHTML=`<div class="poster-wrap"><div class="poster-placeholder">ONM<span>NO POSTER</span></div></div><div class="recommendation-info"><h3>No unrated titles</h3><p>Find another suggestion or add a title.</p><div class="card-actions"><button class="button button-primary" onclick="nextCandidate()">Find another</button><button class="button button-outline" onclick="openAddDialog()">Add a title</button></div></div>`;return}const score=combinedScore(t);const genres=(t.genres||[]).slice(0,3).map(g=>`<span class="genre-tag">${esc(g)}</span>`).join("");el.innerHTML=`<div class="poster-wrap">${imgHtml(t)}</div><div class="recommendation-info"><h3>${esc(t.title)} ${t.year?`<span style="font-size:14px;color:var(--muted);font-weight:400">(${esc(t.year)})</span>`:""}</h3><div class="meta-row"><span>${t.type==="tv"?"TV series":"Movie"}</span>${genres}${score!==null?`<span class="score-chip">Shared score ${score}/200</span>`:""}</div><p>${esc(t.overview||"")}</p><div class="card-actions"><button class="button button-primary" onclick="openRating('${t.id}')">${hasActiveUserRated(t)?"Edit my rating":"Rate this title"}</button><button class="button button-outline" onclick="openDetails('${t.id}')">Details</button><button class="button button-quiet" onclick="nextCandidate()">Skip</button></div></div>`}
function renderWatchlist(){const el=document.getElementById("watchlist-list");const items=state.data.titles.filter(bothRated).sort((a,b)=>combinedScore(b)-combinedScore(a));if(!items.length){el.innerHTML='<div class="empty-state" style="grid-column:1/-1"><strong>No shared scores yet</strong>Once both people rate the same title, it will appear here, ranked by your formula.</div>';return}el.innerHTML=items.map(t=>`<article class="title-card">${imgHtml(t,"title-poster")}<div class="title-card-body"><h3>${esc(t.title)}</h3><p>${esc(t.year||"")} · ${t.type==="tv"?"TV show":"Movie"}</p><span class="score-chip">${combinedScore(t)} / 200</span><button class="button button-outline" onclick="openDetails('${t.id}')">View ratings</button></div></article>`).join("")}
function renderHistory(){const el=document.getElementById("history-list");const items=[...state.data.titles].filter(hasRated).sort((a,b)=>Number(bothRated(a))-Number(bothRated(b)));if(!items.length){el.innerHTML='<div class="empty-state"><strong>Your rating history is empty</strong>Rate a title and it will be recorded here.</div>';return}el.innerHTML=items.map(t=>`<article class="history-row">${imgHtml(t)}<div class="history-info"><h3>${esc(t.title)}</h3><p>${state.data.ratings[t.id]?.a?`${esc(state.data.users.a.name)} rated ${state.data.ratings[t.id].a.own}/10`:"Waiting for "+esc(state.data.users.a.name)} · ${state.data.ratings[t.id]?.b?`${esc(state.data.users.b.name)} rated ${state.data.ratings[t.id].b.own}/10`:"Waiting for "+esc(state.data.users.b.name)}</p></div><span class="status ${bothRated(t)?"complete":""}">${bothRated(t)?`Score ${combinedScore(t)}/200`:"Needs second vote"}</span><button class="button button-quiet" onclick="openDetails('${t.id}')">Details</button></article>`).join("")}
function renderSettings(){document.getElementById("tmdb-key").value=state.tmdbToken;document.getElementById("name-a").value=state.data.users.a.name;document.getElementById("name-b").value=state.data.users.b.name;document.querySelectorAll(".swatch").forEach(b=>b.classList.toggle("selected",b.dataset.color===state.accent));document.documentElement.style.setProperty("--accent",state.accent)}
function openRating(id){const t=state.data.titles.find(x=>x.id===id);if(!t)return;state.currentId=id;const r=ratingFor(id)||{own:5,partner:5};const existing=!!ratingFor(id);document.getElementById("rating-content").innerHTML=`<div class="rating-layout">${imgHtml(t,"rating-poster")}<div class="rating-details"><span class="eyebrow">YOUR TAKE</span><h2>${esc(t.title)}</h2><div class="meta-row">${esc(t.year||"")} · ${t.type==="tv"?"TV show":"Movie"}</div><p>${esc(t.overview||"No synopsis available.")}</p><div class="rating-field"><div class="rating-field-head"><span>How much do you want to watch it?</span><span class="rating-value" id="own-value">${r.own}/10</span></div><input id="own-rating" type="range" min="0" max="10" step="1" value="${r.own}"><div class="range-ends"><span>Not interested</span><span>Very interested</span></div></div><div class="rating-field"><div class="rating-field-head"><span>How much do you think ${esc(state.data.users[state.activeUser==="a"?"b":"a"].name)} wants to watch it?</span><span class="rating-value" id="partner-value">${r.partner}/10</span></div><input id="partner-rating" type="range" min="0" max="10" step="1" value="${r.partner}"><div class="range-ends"><span>Not interested</span><span>Very interested</span></div></div><div class="rating-footer"><button class="button button-outline" onclick="document.getElementById('rating-dialog').close()">Cancel</button><button class="button button-primary" id="save-rating">${existing?"Update my rating":"Save my rating"}</button></div></div></div>`;
document.getElementById("own-rating").addEventListener("input",e=>document.getElementById("own-value").textContent=e.target.value+"/10");document.getElementById("partner-rating").addEventListener("input",e=>document.getElementById("partner-value").textContent=e.target.value+"/10");document.getElementById("save-rating").addEventListener("click",()=>{state.data.ratings[id]=state.data.ratings[id]||{};state.data.ratings[id][state.activeUser]={own:Number(document.getElementById("own-rating").value),partner:Number(document.getElementById("partner-rating").value),updatedAt:new Date().toISOString()};document.getElementById("rating-dialog").close();persist();showToast(bothRated(t)?"Both votes are in — shared score updated.":"Rating saved in this browser.");});document.getElementById("rating-dialog").showModal()}
function openDetails(id){const t=state.data.titles.find(x=>x.id===id);if(!t)return;state.currentId=id;document.getElementById("rating-content").innerHTML=`<div class="rating-layout">${imgHtml(t,"rating-poster")}<div class="rating-details"><span class="eyebrow">TITLE DETAILS</span><h2>${esc(t.title)}</h2><div class="meta-row">${esc(t.year||"")} · ${t.type==="tv"?"TV show":"Movie"} ${bothRated(t)?`· Shared score ${combinedScore(t)}/200`:""}</div><p>${esc(t.overview||"No synopsis available.")}</p><div class="rating-field"><strong style="font-size:12px">Ratings so far</strong><p>${["a","b"].map(u=>state.data.ratings[id]?.[u]?`${esc(state.data.users[u].name)}: own ${state.data.ratings[id][u].own}/10, partner estimate ${state.data.ratings[id][u].partner}/10`:`${esc(state.data.users[u].name)} has not rated yet`).join("<br>")}</p></div><label for="custom-poster-file">Upload custom poster</label><input id="custom-poster-file" type="file" accept="image/*"><div class="rating-footer"><button class="button button-outline" onclick="removeTitle('${id}')">Remove title</button><button class="button button-primary" onclick="document.getElementById('rating-dialog').close();openRating('${id}')">Rate this title</button></div></div></div>`;
document.getElementById("custom-poster-file").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;if(f.size>2*1024*1024){showToast("Please use an image under 2 MB.");return}const data=await fileToDataURL(f);t.customPoster=data;persist();openDetails(id);showToast("Custom poster saved in this browser.");});document.getElementById("rating-dialog").showModal()}
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
function addTitle(raw){const existing=state.data.titles.find(t=>(raw.tmdbId&&String(t.tmdbId)===String(raw.tmdbId)&&t.type===raw.type)||(!raw.tmdbId&&t.title.toLowerCase()===raw.title.toLowerCase()));if(existing){state.currentId=existing.id;showToast(hasActiveUserRated(existing)?"You have already rated this title.":"This title is already in your list — ready for your rating.");return existing}const t={id:titleId(raw),title:raw.title,type:raw.type||"movie",tmdbId:raw.tmdbId||null,overview:raw.overview||"",posterPath:raw.posterPath||"",customPoster:raw.customPoster||"",year:raw.year||"",genres:raw.genres||[],addedAt:new Date().toISOString(),source:raw.source||"manual"};state.data.titles.unshift(t);state.currentId=t.id;persist();return t}
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
document.getElementById("active-user").addEventListener("change",e=>{state.activeUser=e.target.value;renderAll();showToast("Voting as "+state.data.users[state.activeUser].name);});
document.getElementById("refresh-recs").addEventListener("click",()=>nextCandidate());
document.getElementById("manual-add").addEventListener("click",openAddDialog);
document.getElementById("search-tmdb").addEventListener("click",searchTMDB);
document.getElementById("title-search").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchTMDB()}});
document.getElementById("create-manual").addEventListener("click",async()=>{const title=document.getElementById("manual-title").value.trim();if(!title){showToast("Enter a title first.");return}const f=document.getElementById("manual-image").files[0];if(f&&f.size>2*1024*1024){showToast("Please use an image under 2 MB.");return}const customPoster=f?await fileToDataURL(f):"";const t=addTitle({title,type:document.getElementById("manual-type").value,overview:document.getElementById("manual-overview").value.trim(),customPoster,source:"manual"});document.getElementById("add-dialog").close();renderAll();showToast("Added "+t.title+".")});
document.getElementById("save-key").addEventListener("click",()=>{state.tmdbToken=document.getElementById("tmdb-key").value.trim();localStorage.setItem("df_tmdb_token",state.tmdbToken);showToast("TMDB token saved in this browser.");});
document.getElementById("save-names").addEventListener("click",()=>{state.data.users.a.name=document.getElementById("name-a").value.trim()||"Alex";state.data.users.b.name=document.getElementById("name-b").value.trim()||"Jamie";persist();showToast("Preferences saved.");});
document.querySelectorAll(".swatch").forEach(b=>b.addEventListener("click",()=>{state.accent=b.dataset.color;localStorage.setItem("df_accent",state.accent);renderSettings()}));
document.getElementById("export-data").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state.data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="our-next-movie-backup.json";a.click();URL.revokeObjectURL(a.href)});
document.getElementById("import-data").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d.users||!Array.isArray(d.titles)||!d.ratings)throw new Error("This doesn't look like a Double Feature backup.");state.data=d;persist();showToast("Backup imported.");}catch(err){showToast(err.message||"Could not import backup.")}e.target.value=""});
document.getElementById("reset-data").addEventListener("click",()=>{if(!confirm("This deletes all titles and ratings saved in this browser. Export a backup first if you want to keep them. Continue?"))return;state.data=freshData();state.currentId=null;persist();showToast("Local data reset.")});
window.openAddDialog=openAddDialog;window.openRating=openRating;window.openDetails=openDetails;window.removeTitle=removeTitle;window.setView=setView;window.nextCandidate=nextCandidate;
renderAll();
