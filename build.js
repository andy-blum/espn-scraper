const puppeteer = require('puppeteer');
const writeJsonFile = require('write-json-file');

let html, $, data;
const NFLteams = [];
const NFLplayers = [];

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' });
  const page = await browser.newPage();

  // Get the teams
  console.log('Updating Teams...')
  await page.goto(`https://www.espn.com/nfl/teams`);
  html = await page.content();
  data = await page.evaluate('__espnfitt__.page.content.teams.nfl');
  for (const conf of data) {
    const teams = conf.teams;
    for (const team of teams) {
      const NFLteam = {
        'abbr': team.abbrev,
        'full': team.name,
        'logo': team.logo,
      }
      NFLteams.push(NFLteam);
    }
  }
  console.log(`Found ${NFLteams.length} in the league.`);


  // Get the rosters
  const playerIds = [];
  console.log('Updating Rosters...');
  for (const team of NFLteams) {
    console.log(`    Loaded ${team.full}`);
    await page.goto(`https://www.espn.com/nfl/team/roster/_/name/${team.abbr}`);
    html = await page.content();
    data = await page.evaluate('__espnfitt__.page.content.roster.groups');
    for (const posgroup of data) {
      const players = posgroup.athletes;
      for (const player of players) {
        if (
          player.position != 'OT' &&
          player.position != 'G' &&
          player.position != 'C'
        ) {
          playerIds.push(player.id);
        }
      }
    }
  }
  console.log(`Found ${playerIds.length} players on active rosters.`);

  // Get all player info
  console.log('Building active player list...');
  for (const id of playerIds) {
    console.log(`${NFLplayers.length + 1}/${playerIds.length} (${id})`)
    await page.goto(`https://www.espn.com/nfl/player/_/id/${id}`);
    html = await page.content();
    data = await page.evaluate('__espnfitt__.page.content.player');

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

    NFLplayers.push(player);
  }

  // Write results to file
  console.log('Writing to disk...');
  await writeJsonFile('./teams.json', NFLteams);
  await writeJsonFile('./players.json', NFLplayers);
  console.log('Done.');
  await browser.close();
})();