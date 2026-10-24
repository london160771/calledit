export const scopes = ['user:read:chat','user:write:chat','user:bot'];
/** OAuth credentials stay in server memory. HTTP errors never include response bodies or tokens. */
export function createTwitchAuth({clientId,clientSecret,redirectUri,accessToken,refreshToken,fetchImpl=fetch}) {
  let tokens={access_token:accessToken,refresh_token:refreshToken}, identity, refreshing;
  async function tokenRequest(params) {
    const response=await fetchImpl('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,...params}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Twitch authorization failed. Connect again.');
    tokens=await response.json();
    return tokens;
  }
  async function refresh() {
    if(!tokens.refresh_token)throw new Error('Connect with Twitch again.');
    refreshing??=tokenRequest({grant_type:'refresh_token',refresh_token:tokens.refresh_token}).finally(()=>{refreshing=undefined;});
    await refreshing;
  }
  async function authorized(url, options={}) {
    const send=()=>fetchImpl(url,{...options,headers:{...options.headers,'Client-Id':clientId,Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(10000)});
    let response=await send();
    if(response.status===401){await refresh();response=await send();}
    return response;
  }
  return {
    authorizeUrl(state){return `https://id.twitch.tv/oauth2/authorize?${new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:scopes.join(' '),state})}`;},
    async exchange(code){await tokenRequest({grant_type:'authorization_code',code,redirect_uri:redirectUri});return this.validate();},
    async validate(){
      if(!tokens.access_token)throw new Error('Connect with Twitch first.');
      const response=await authorized('https://id.twitch.tv/oauth2/validate');
      if(!response.ok)throw new Error('Twitch token validation failed. Connect again.');
      const data=await response.json();
      if(data.client_id!==clientId||!data.user_id||!scopes.every(scope=>data.scopes?.includes(scope)))throw new Error('Twitch account or scopes do not match. Connect again.');
      identity={userId:data.user_id,login:data.login};return {...identity};
    },
    async helix(path,body){
      if(!identity)throw new Error('Connect with Twitch first.');
      const response=await authorized(`https://api.twitch.tv/helix/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!response.ok)throw new Error(`Twitch API failed (${response.status}).`);
      return response.json();
    },
    getIdentity(){return identity?{...identity}:null;},
    clear(){tokens={};identity=undefined;}
  };
}
