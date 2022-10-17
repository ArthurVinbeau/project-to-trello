# Microsoft Projects to Trello cards

## Installation

Download the project on [GitHub](https://github.com/ArthurVinbeau/project-to-trello) (clone or as a zip file)

Download and install [NodeJS](https://nodejs.org) (I built and used this tool on node `v18.0.0`)

Run `npm i` in the root folder of the project

## Configuration

You will need a [trello REST API key](https://trello.com/app-key) and a Token (if you have any issues, follow the [documentation](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/))

Rename the file `inputs/config.example.json` to `inputs/config.json` and start filling the `api` and `board` fields

Use `npm run setup`

This command will create a folder named `outputs` where you will find all the ids you need to fill the remaining `config.json` fields.

## Usage

In Microsoft Project, save your file as a CSV (File > Save as > tasks.csv), see `inputs/tasks.example.csv` for the expected formatting.

Put your csv file in the `inputs` folder and make sure it is named as `tasks.csv`

Use `npm run start`

Enjoy!
