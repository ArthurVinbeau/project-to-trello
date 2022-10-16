import * as fs from 'fs';
import { writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import { exit } from 'process';
import { parse } from 'csv-parse';

const files = {
    config: "./inputs/config.json",
    tasks: "./inputs/tasks.csv",
}

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toRegExp = (array) => new RegExp(`( |^|\\()(${array.map(e => escapeRegExp(e)).join("|")})( |$|\\))`, 'i');

if (!fs.existsSync(files.config)) {
    console.error(`You must provide the config file at ${files.config} (hint: use config.example.json as a guide).`)
    exit(1);
}

// Read config
const config = JSON.parse(fs.readFileSync(files.config));

const baseRoute = "https://api.trello.com/1";

// Check if config is valid
if (!config || !config.api || !config.board) {
    const example = { api: { key: "api key", token: "user token" }, board: "board id" };
    console.error(`You must at least provide the board id and api object in inputs/config.json :\n${JSON.stringify(example, null, 2)}`);
    exit(1);
}

const params = { key: config.api.key, token: config.api.token };

// Check for arguments to run setup script or upload script
if (process.argv.length > 2 && process.argv.find(e => e === '--setup')) {
    const board = `${baseRoute}/boards/${config.board}`
    const query = Object.entries(params).map((e) => `${e[0]}=${e[1]}`).join('&');
    fs.mkdirSync('outputs', { recursive: true });

    // Fetch members, labels & lists from trello and save them locally
    const promises = [
        fetch(`${board}/members?${query}`).then(async (response) => writeFile('./outputs/members.json', JSON.stringify(await response.json(), null, 4))),
        fetch(`${board}/labels?${query}`).then(async (response) => writeFile('./outputs/labels.json', JSON.stringify(await response.json(), null, 4))),
        fetch(`${board}/lists?${query}`).then(async (response) => writeFile('./outputs/lists.json', JSON.stringify(await response.json(), null, 4))),
    ];
    await Promise.all(promises);
    console.log(`Use the files in ./outputs/ to setup ${files.config}`);
} else {
    // Check if tasks are provided
    if (!fs.existsSync(files.tasks)) {
        console.error(`You must provide the tasks file at ${files.tasks} (hint: use tasks.example.csv as a guide).`)
        exit(1);
    }

    // Setup labels regex
    config.labels = config.labels.map(label => {
        label.keywords = toRegExp(label.keywords);
        return label;
    });

    // Skip tasks containing given keywords
    if (config.skip) {
        config.skip = toRegExp(config.skip);
    }

    // Fetch existing cards
    const cards = await fetch(`${baseRoute}/lists/${config.targetList}/cards?${Object.entries(params).map((e) => `${e[0]}=${e[1]}`).join('&')}`).then(res => res.json());

    const parser = parse({ delimiter: ";" });

    const promises = [];
    let parent = "";
    let parentLabels = {};

    // Task_Summary_Name;Name;Duration;Resource_Names
    parser.on('readable', async () => {
        let record;
        while ((record = parser.read()) !== null) {
            // If there is a ressource (one or more people) for this task
            if (record[3]) {
                // Check if the category is to be skipped
                if (config.skip && (record[0].match(config.skip) || parent.match(config.skip))) continue;

                // Create a set of this task's labels
                let labels = { ...parentLabels };
                config.labels.forEach(label => {
                    if (label.parent && label.parent !== parent) return;
                    if (record[0].match(label.keywords)
                        || (!label.searchOnlyInCategory && record[1].match(label.keywords))) {
                        labels[label.id] = true;
                    }
                });

                // Keep only the labels' names
                labels = Object.keys(labels);

                let users = [];

                // ...;...;...;"userA;userB;userC"
                // set this task's users
                record[3].split(";").forEach(user => {
                    let u = config.users[user];
                    if (!u) {
                        console.error(`User not found: ${u}`);
                        exit(1);
                    } else {
                        users.push(u);
                    }
                });

                // If there is a exact copy of this card on the trello board, skip it
                if (cards.find(card => card.name === record[1]
                    && card.idMembers.length === users.length && card.idMembers.every(member => users.includes(member))
                    && card.labels.length == labels.length && card.labels.every(label => labels.includes(label.id)))) {
                    console.log(`Card "${JSON.stringify({ name: record[1], labels, users })} already exists`);
                    continue;
                }

                // Setup the query parameters
                const p = new URLSearchParams({
                    ...params,
                    "name": record[1],
                    "desc": "(made with project-to-trello)",
                    "pos": "top",
                    "idList": config.targetList,
                    "idMembers": users.join(','),
                    "idLabels": labels.join(',')
                });

                const tmp = { name: record[1], labels, users };

                // Create the card
                promises.push(fetch(`${baseRoute}/cards`, { method: "POST", body: p }).then(async response => {
                    if (response.status != 200) {
                        console.error(`Error while creating card "${JSON.stringify(tmp)}, expected 200 but got ${response.status}: ${await response.text()}`);
                    }
                    return response;
                }));

            } else {
                // If there is no ressource attached to this task, it's a category
                parent = record[0];
                // reset the parent labels
                parentLabels = {};
                if (parent) {
                    // Find the corresponding category
                    config.labels.forEach(label => {
                        if (parent.match(label.keywords)) {
                            parentLabels[label.id] = true;
                        }
                    });
                }
            }
        }
    });

    parser.on('end', async () => {
        await Promise.all(promises);
        console.log('Non duplicate cards were created successfully');
    })

    fs.createReadStream(files.tasks).pipe(parser);
}
