export default {
  
  async MajorOrder(env) {
    /* functions */
    function formatNumber(number) {
      var buffer = ""
      var text = number.toString()
      var index0 = 0
      var index = (text.length % 3)
      while (index < text.length) {
        buffer += text.slice(index0, index) + ","
        index0 = index
        index += 3
      }
      buffer += text.slice(index0, text.length)
      if (buffer[0] == ",") {
        buffer = buffer.slice(1, buffer.length)
      }
      if (buffer[buffer.length-1] == ",") {
        buffer = buffer.slice(0, buffer.length-1)
      }
      return(buffer)
    }
    function createTimePayload (MajorOrderExpiration) {
      const expiration = MajorOrderExpiration
      const now = Date.parse(Date())
      var diff = expiration - now
      const days = (diff - diff%86400000)/86400000
      diff -= days*86400000
      const hours = (diff - diff%3600000)/3600000
      diff -= hours*3600000
      const minutes = (diff - diff%60000)/60000
      var time
      if (days) {
        time = days+'D '+hours+'H'
      } else {
        time = hours+'H '+minutes + 'M'
      }
      return(time)
    }

    /* Feitching fresh MO */
    const MajorOrder = await this.fetchMajorOrder()
    const Planets = await this.fetchPlanets()
    var text
      console.log(MajorOrder)
      if (MajorOrder != undefined) {
        /* Major Order variables */
        const MOtypes = {
          2: 'Sample Collection',
          3: 'Extermination',
          12: 'Multiple Defense'
        }
        const MOitems = {
          3992382197: "common sample",
          2985106497: "rare sample"
        }

        var targetsList = []
        for (let i=0;i < MajorOrder.tasks.length;i++) {
          /* Decoding MO */
          const task = MajorOrder.tasks[i]
          const target = {
            "typeId" : MajorOrder.tasks[i].type,
            "faction" : null,
          }
          if (MOtypes[target.typeId]) {
            target.type = MOtypes[target.typeId]
          } else {
            target.type = "Planet"
          }

          for (let k=0;k < task.values.length;k++) {
            if (task.valueTypes[k] == 12) { /* Planet */
              target.planetId = task.values[k]
              if (target.planetId != 0) {
                target.planetName = Planets[target.planetId]
              }
            } else if (task.valueTypes[k] == 5) { /* Item */
              target.item = MOitems[task.values[k]]
            } else if (task.valueTypes[k] == 3) { /* Goal */
              target.goal = task.values[k]
            }
          }
          console.log(target)
    
          if (target.typeId == 3) { /* Extermination */
            if (target.planetId != 0) {
              target.planetName = Planets[target.planetId].name
            }
            target.count = MajorOrder.progress[i]
            target.goal = MajorOrder.tasks[i].values[2]
            target.progress = Math.round(target.count/target.goal*1000 + Number.EPSILON)/10
    
            if (MajorOrder.tasks[i].values[1] == 1) {
              target.faction = "Terminids"
            } else {
              target.faction = "Automaton"
            }
            
            target.goal = formatNumber(target.goal)
            target.count = formatNumber(target.count)
    
          } else if (target.typeId == 12) { /* Defend multiple planets */ 
            target.goal = MajorOrder.tasks[i].values[0]
            if (MajorOrder.tasks[i].values[1] == 2) {
              target.faction = "Terminids"
            } else {
              target.faction = "Automaton"
            }
            target.count = MajorOrder.progress[i]
            target.progress = Math.round(target.count/target.goal*1000 + Number.EPSILON)/10
          } else if (target.typeId == 2) { /* Sample collection */
            target.goal = MajorOrder.tasks[i].values[2]
            target.count = MajorOrder.progress[i]
            target.progress = Math.round(target.count/target.goal*1000 + Number.EPSILON)/10
            if (target.planetId != 0) {
              const planet = Planets[target.planetId]
              target.planetName = planet.name
              if (planet.event != null) {
                target.faction = planet.event.faction
              } else {
                target.faction = planet.currentOwner
              }
            }
            target.item = MOitems[MajorOrder.tasks[i].values[4]]
            target.goal = formatNumber(target.goal)
            target.count = formatNumber(target.count)
          } else { /* Planet */
            const planet = Planets[target.planetId]
            target.planetName = planet.name
            
            var maxHealth
            var health
            if (planet.event != null) {
              target.type = "Defense"
              target.faction = planet.event.faction
              maxHealth = planet.event.maxHealth
              health = planet.event.health
            } else {
              maxHealth = planet.maxHealth
              health = planet.health
              target.faction = planet.currentOwner
            }
            if (target.faction == "Humans") {
              target.progress = 100
            } else {
              target.progress = Math.round((1 - health/maxHealth)*1000 + Number.EPSILON)/10
            }
          }
    
          targetsList.push(target)
        }
        console.log(targetsList)
        const expiration = Date.parse(MajorOrder.expiration)
        const isExpired = expiration < await Date.parse(Date())
    
        text = encodeURI('return {') + '%0A' +
        '    ["Status"]     = "ongoing",%0A' +
        '    ["Desc"]       = "' + MajorOrder.briefing + '",%0A' +
        '    ["Targets"]    = {%0A'
        for (let i = 0; i < targetsList.length; i++) {
          const target = targetsList[i]
          console.log(target)
          text += '        {%0A' + 
          '            ["Type"]     = "' + target.type + '",%0A' +
          '            ["Faction"]  = "' + target.faction + '",%0A' +
          '            ["Planet"]   = "' + target.planetName + '",%0A' +
          '            ["Progress"] = "' + target.progress + '",%0A'
          if (target.count != undefined) {
            text += '            ["Count"]    = "' + target.count + '",%0A'
          }
          if (target.goal != undefined) {
            text += '            ["Goal"]     = "' + target.goal + '",%0A'
          }
          if (target.item != undefined) {
            text += '            ["Item"]    = "' + target.item + '",%0A'
          }
          text += '        },%0A'
        }
        text = text.slice(0, text.length-4) + '%0A'
        text +=
        '    },%0A' +
        '    ["Expiration"] = "' + createTimePayload(expiration) + '",%0A' +
        '    ["Reward"]     = "' + MajorOrder.reward.amount + '"%0A' +
        '}'
      } else {
          text = encodeURI('return {') + '%0A' +
        '    ["Status"] = "unavailable",%0A' +
        '}'
      }
    return(text)
  },

  async fetch(request, env, ctx) {
    if (request.method === 'POST') {
      const payload = await request.json()
      const Cookie = await this.getWikiLoginCookie(env)
      if (payload == "Major Order") { /* Major Order update */
        const text = await this.MajorOrder(env)
        console.log(text)
        await this.editWiki(Cookie, 'Module:Data/MajorOrders', text)
    } else if (payload == "Patch") { /* Major Order update */

      const postList = await this.fetchPost()
      var k = 0
      var lastPatch = null
      while (lastPatch == null && k < 20) {
        const post = postList[k]
        console.log(post)
        if (post.title.toLowerCase().includes('patch')) {
          lastPatch = post
        }
        k += 1
      }
      if (lastPatch != null) {
        const payloadPatch = await this.createPatchPayload(lastPatch)
        await this.editWiki(Cookie, 'Module:Data/LatestPatch', payloadPatch)
        console.log(payloadPatch)
      }

    }
  } 
    /*const url = `https://api.telegram.org/bot6456899038:AAF77UCiYBe2dfdVsmIy9l5NiM2bkMYQADo/sendMessage?chat_id=1307263371&text=${event.cron}`
    const data = await fetch(url).then(resp => resp.json())*/
    return new Response('Hello World')
  },

  async scheduled(event, env, ctx) {
    const Cookie = await this.getWikiLoginCookie(env)
    if (event.cron == '0,10,20,30,40,50 * * * *') { /* Major Order update */
      const text = await this.MajorOrder(env)
      console.log(text)
      await this.editWiki(Cookie, 'Module:Data/MajorOrders', text)
    } else if (event.cron == '5,15,25,35,45,55 * * * *') { /* Patch notes update */
    
      const postList = await this.fetchPost()
      var k = 0
      var lastPatch = null
      while (lastPatch == null && k < 20) {
        const post = postList[k]
        console.log(post)
        if (post.title.toLowerCase().includes('patch')) {
          lastPatch = post
        }
        k += 1
      }
      if (lastPatch != null) {
        const payloadPatch = await this.createPatchPayload(lastPatch)
        await this.editWiki(Cookie, 'Module:Data/LatestPatch', payloadPatch)
        console.log(payloadPatch)
      }

    }
    await this.logoutFromWiki(Cookie)
  },

  async getWikiLoginCookie(env) {
    const loginQuery = await (await this.getFromWiki('query', '', '&meta=tokens&type=login'))
    const loginToken = encodeURIComponent((await loginQuery.json()).query.tokens.logintoken)
    /*console.log('1. Login token:', loginToken)*/
    const Cookie0 = loginQuery.headers.getSetCookie()[0]
    const loginAttempt = await this.postToWiki('login', Cookie0, "lgname=" + env.botName + "&lgpassword=" + env.botKey + "&lgtoken=" + loginToken)
    const loginCookie = loginAttempt.headers.get("Set-Cookie")
    /*console.log(await loginAttempt.json())*/
    return(loginCookie)
  },

  async editWiki(cookie, pageTitle, text) {
    const editQuery = await (await this.getFromWiki('query', cookie, '&meta=tokens')).json()
    const editToken = encodeURIComponent((editQuery).query.tokens.csrftoken)
    /*console.log(editQuery)*/
    const response = await this.postToWiki('edit', cookie, '&title=' + pageTitle + '&text=' + text + '&bot=1&token=' + editToken)
    console.log(await response.json())

  },
   
  async getFromWiki(action, cookie, args) {
    const response = await fetch('https://helldivers.fandom.com/api.php?format=json&action=' + action + args, {
      method: 'GET',
      headers: {
        Cookie : cookie,
      },
    })
    return(response)
  },

  async postToWiki(action, cookie, body) {
    const response = await fetch('https://helldivers.fandom.com/api.php?format=json&action=' + action, {
      method: 'POST',
      headers: {
        "Content-Type" : "application/x-www-form-urlencoded",
        Cookie : cookie,
      },
      body: body
    });
    return(response)
  },

  async logoutFromWiki(cookie) {
    const loguotToken = encodeURIComponent((await (await this.getFromWiki('query', cookie, '&meta=tokens')).json()).query.tokens.csrftoken)
    await this.postToWiki('logout', cookie, 'token=' + loguotToken)
  },

  async fetchMajorOrder() {
    const queryTask = await fetch('https://api.helldivers2.dev/api/v1/assignments', {
      method: 'GET',
      headers: {
        'X-Super-Client' : 'Fandom Wiki',
        'X-Super-Contact' : 'Discord: graffmontecarl0'
    }
    })
    /*console.log(queryTask)*/
    const MajorOrder = (await queryTask.json())[0]
    /*console.log('2. MO:', MajorOrder)*/
    return(MajorOrder)
  },

  async fetchPlanets() {
    const queryPlanets = await fetch('https://api.helldivers2.dev/api/v1/planets/', {
          method: 'GET',
          headers: {
            'X-Super-Client' : 'Fandom Wiki',
            'X-Super-Contact' : 'Discord: graffmontecarl0'
        }
        })
      /*console.log(queryPlanets)*/
      return(await queryPlanets.json())
  },

  async fetchPost() {
    const queryPost = await fetch('https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=553850&feeds=steam_community_announcements', {
        method: 'GET'
      })
    /*console.log(queryPost)*/
    const postList = (await queryPost.json())
    console.log(postList)
    return (postList.appnews.newsitems)
  },

  async createPatchPayload(currentPost) {
    
    const postTitle = currentPost.title
    const patchURL = currentPost.url
      const patchContent = currentPost.contents
      const patchChangesBuffer = patchContent.split('\n[list]')[1].split('\n[/list]')[0].split('\n[*] ')
      var patchChanges = []
      for (let i = 1; i<patchChangesBuffer.length;i++) {
        patchChanges[i-1] = patchChangesBuffer[i]
      }
  
      var changesList = ''
      for (let i = 0; i < patchChanges.length; i++) {
        changesList += encodeURI('        "' + patchChanges[i] + '",') + '%0A'
      }
  
  
      var textPatch=encodeURI('return {') + '%0A' +
      encodeURI('    ["Title"]    = "') + postTitle + '",' + '%0A' +
      encodeURI('    ["Link"]    = "') + patchURL + '",' + '%0A' +
      encodeURI('    ["Changes"] = {') + '%0A' +
      changesList +
      encodeURI('    },') + '%0A' +
      encodeURI('}')
  
      return(textPatch)
  },
  
  async buildCurrentMO(env) { /* UNUSED */
    const currentMOpatch = (await env.db.prepare("SELECT status, briefing, task, targets, expiration, reward, progress FROM MajorOrder").raw())[0]
    console.log(currentMOpatch)
    const currentStatus = currentMOpatch[0]
    const currentBriefing = currentMOpatch[1]
    const currentTask = currentMOpatch[2]
    const currentTargets = JSON.parse(currentMOpatch[3])
    const currentReward = currentMOpatch[4]
    const currentExpiration = currentMOpatch[5]
    const currentMO = {
      "status":currentStatus,
      "briefing":currentBriefing,
      "task":currentTask,
      "targets":currentTargets,
      "reward":currentReward,
      "expiration":currentExpiration,
    }
    return(currentMO)
  }
};
