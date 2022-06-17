import * as fs from 'fs';
import { writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import { exit } from 'process';

const files = {
    config: "./inputs/config.json",
    tasks: "./inputs/tasks.csv",
}

if (!fs.existsSync(files.config)) {
    console.error(`You must provide the config file at ${files.config} (hint: use config.example.json as a guide).`)
    exit(1);
}

const config = JSON.parse(fs.readFileSync(files.config));

const baseRoute = "https://api.trello.com/1";

if (!config || !config.api || !config.board) {
    const example = { api: { key: "api key", token: "user token" }, board: "board id" };
    console.error(`You must at least provide the board id and api object in inputs/config.json :\n${JSON.stringify(example, null, 2)}`);
    exit(1);
}

const params = { key: config.api.key, token: config.api.token };

if (process.argv.length > 2 && process.argv.find(e => e === '--setup')) {
    const board = `${baseRoute}/boards/${config.board}`
    const query = Object.entries(params).map((e) => `${e[0]}=${e[1]}`).join('&');
    fs.mkdirSync('outputs', { recursive: true });
    const promises = [
        fetch(`${board}/members?${query}`).then(async (response) => writeFile('./outputs/members.json', JSON.stringify(await response.json(), null, 4))),
        fetch(`${board}/labels?${query}`).then(async (response) => writeFile('./outputs/labels.json', JSON.stringify(await response.json(), null, 4))),
        fetch(`${board}/lists?${query}`).then(async (response) => writeFile('./outputs/lists.json', JSON.stringify(await response.json(), null, 4))),
    ];
    await Promise.all(promises);
    console.log(`Use the files in ./outputs/ to setup ${files.config}`)
} else {
    // send cards!
}
