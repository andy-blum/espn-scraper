const fetch = require('node-fetch')
const writeJsonFile = require('write-json-file');
const getObj = require('json-from-text');

const promises = {
  'rosters': [],
  'players': []
};

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
            await writeJsonFile('./posgroups.json', group);
            for (const player of group.athletes) {
              ids.push(player.id);
            }
          }
        }
      }
    }
  });
  await writeJsonFile('./NFLPlayerIDs.json', ids);

  // Fetch all player info
  const players = [];
  for (const id of ids) {
    console.log(`Player ${players.length + 1} of ${ids.length}`);
    const payload = await fetch(`https://www.espn.com/nfl/player/_/id/${id}`)
      .then(resp => resp.text())
      .then(text => getObj(text).jsonResults)
      .catch(err => console.log(err));

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
        if (players.length % 50 === 0) {
          await writeJsonFile('./NFLPlayers.json', players);
        }
      }
    }
  }
  await writeJsonFile('./NFLPlayers.json', players);
})();