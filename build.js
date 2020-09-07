const fetch = require('node-fetch')
const writeJsonFile = require('write-json-file');
const getObj = require('json-from-text');


const key = /window\[\'\_\_espnfitt\_\_\'\]/;

(async () => {

  // Fetch all teams
  let payload = await fetch('https://www.espn.com/nfl/teams')
    .then(resp => resp.text())
    .then(text => getObj(text).jsonResults)
    .catch(err => console.log(err));

  const teams = [];
  for (const key in payload) {
    if (payload[key].hasOwnProperty('page')) {
      let conferences = payload[key].page.content.teams.nfl;
      for (const conference of conferences) {
        for (const team of conference.teams) {
          teams.push(team);
        }
      }
      await writeJsonFile('./NFLTeams.json', teams);
    }
  }

  // Fetch all ids from team rosters
  const ids = [];
  let promises = [];
  for (const team of teams) {
    promises.push(fetch(`https://www.espn.com/nfl/team/roster/_/name/${team.abbrev}`)
      .then(resp => resp.text()))
  }
  await Promise.all(promises).then(async (vals) => {
    for (const val of vals) {
      const payload = getObj(val).jsonResults;
      for (const key in payload) {
        if (payload[key].hasOwnProperty('page')) {
          let posgroups = payload[key].page.content.roster.groups;
          for (const group of posgroups) {
            for (const player of group.athletes) {
              ids.push(player.id);
            }
          }
        }
      }
    }
  });
  await writeJsonFile('./NFLPlayerIDs.json', ids);

  // Create blocks of 25 ids to fetch in parallel
  const players = [];
  const chunks = [];

  const chunkSize = 10
  const chunkCount = Math.ceil(ids.length / chunkSize);
  const idsLength = ids.length;

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    const chunk = [];
    for (let index = 0; index < chunkSize; index++) {
      if (ids[0]) {
        chunk.push(ids.shift());
      }
    }
    chunks.push(chunk);
  }

  // Fetch players
  for (const chunk of chunks) {
    let promises = [];

    for (const id of chunk) {
      promises.push(fetch(`https://www.espn.com/nfl/player/_/id/${id}`)
        .then(resp => resp.text()))
    }

    await Promise.all(promises).then(async (vals) => {
      for (const val of vals) {
        const payload = getObj(val).jsonResults;
        for (const key in payload) {
          if (payload[key].hasOwnProperty('page')) {
            let data = payload[key].page.content.player;

            const ath = data.prtlCmnApiRsp.athlete;
            const header = data.plyrHdr.ath
            const player = {
              'age': ath.age,
              'dob': ath.displayDOB,
              'firstName': header.fNm,
              'id': ath.playerId,
              'img': header.img,
              'lastName': header.lNm,
              'logo': header.logo,
              'num': header.dspNum,
              'pos': header.posAbv,
              'status': ath.abbreviation,
              'team': ath.team.abbrev,
            };

            if (!!ath.displayDraft) {
              player.draft = ath.displayDraft.substr(0, 4)
            }

            players.push(player);
          }
        }
      }
    });

    await writeJsonFile('./NFLPlayers.json', players);
    console.log(`${players.length}/${idsLength}`);
  }

})();