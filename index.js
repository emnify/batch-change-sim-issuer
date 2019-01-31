#!/usr/bin/env node

'use strict';

const Promise = require('promise');
const request = require('request');
const throttledRequest = require('throttled-request')(request);
const inquirer = require("inquirer");
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

throttledRequest.configure({
  requests: 10,
  milliseconds: 1000
}); //This will throttle the requests so no more than 10 are made every second

const API_URL = "https://cdn.emnify.net/api/v1";

const askQuestions = () => {
  const questions = [{
      name: "DRYRUN",
      type: "confirm",
      message: "Do you want to do a dry run (test run) without applying any changes?"
    },
    {
      name: "IDENTIFIER",
      type: "list",
      message: "How do you identify the sim cards in your CSV?",
      choices: ["by iccid", "by imsi", "by simid"],
      filter: function (val) {
        return val.split(" ")[1];
      }
    },
    {
      name: "FILEPATH",
      type: "input",
      message: "What's the path of the CSV file with all the sims listed? Please make sure it does NOT have a header!",
      default: "sample.csv"
    },
    {
      name: "DESTORGID",
      type: "input",
      message: "What's the organisation id of the organisation you want assign as the new issuer?",
      validate: function (val) {
        let num = Number(val);
        if (num > 0)
          return true
        else {
          return "Please enter a valid organisation id."
        }
      }
    },
    {
      name: "MASTERTOKEN",
      type: "password",
      message: "Please give an application token of the current issuer organisation of the sim cards.",
      validate: function (val) {
        if (jwt.decode(val)) {
          return true;
        } else {
          return "Please enter a valid application token."
        }
      }
    }
  ];
  return inquirer.prompt(questions);
};

const authenticate = (token) => {
  return new Promise((resolve, reject) => {
    let t = jwt.decode(token);
    console.log("Authenticating user " + t["sub"] + " of organisation " + t["esc.orgName"] + "(" + t["esc.org"] + ")...");
    request.post(API_URL + "/authenticate", {
      body: {
        "application_token": token
      },
      json: true
    }, function (err, res, body) {
      if (err) {
        console.log("Error authenticating", t["sub"], err, body);
      }
      if (res.statusCode === 200) {
        console.log("Successfully authenticated", t["sub"]);
        return resolve(body.auth_token);
      } else {
        console.log("Errorcode", res.statusCode, "occured while authenticating", t["sub"], body);
      }
    });
  });
}

function readCsvFile(filePathString) {
  return new Promise((resolve, reject) => {
    console.log("Reading the CSV file from", filePathString + "...")
    let filePath = path.join(filePathString);
    fs.readFile(filePath, {
      encoding: 'utf-8'
    }, function (err, csvContent) {
      if (!err) {
        csvContent = csvContent.replace(/(\s\r\n|\n|\r|\s)/gm, "");
        let list = csvContent.split(',');
        console.log("Sucessfully processed the CSV file with", list.length, "sims");
        return resolve(list);
      } else {
        console.log("Error processing the CSV file, here's the content:", list);
        return reject(err);
      }
    });
  });
}

const getArrayOfSimIds = (identifiers, type, masterToken) => {
  return new Promise((resolve, reject) => {
    let t = jwt.decode(masterToken);
    console.log("Fetching SIM IDs for provided", type + "s...");
    if (type == "simid") {
      return resolve(identifiers);
    };
    let identifiersProcessed = 0;
    let arrayOfSimIds = [];
    identifiers.forEach(function (id, index, array) {
      console.log(id);
      throttledRequest(API_URL + "/sim?page=1&per_page=2&q=" + type + ":" + id, {
        'auth': {
          'bearer': masterToken
        },
        json: true
      }, function (err, res, body) {
        if (err) {
          console.log("Error getting the SIM for", type, id, err, body);
        } else if (!body.length) {
          console.log(type, id, "matches no SIM of", t["esc.orgName"],"(" + t["esc.org"] + ")");
        } else if (body.length > 1) {
          console.log(type, id, "matches more than one SIM, are you sure the", type, "is complete?");
        } else if (res.statusCode === 200) {
          arrayOfSimIds.push(body[0].id);
          console.log('SIM ID for', type, id, 'is', body[0].id);
        } else {
          console.log("Errorcode", res.statusCode, "occured while getting SIM with", type, id, body);
        }
        identifiersProcessed++;
        if (identifiersProcessed === array.length) {
          return resolve(arrayOfSimIds);
        }
      });
    });
  });
}

const updateAllSimsOrgId = (simIds, orgId, masterToken, dryRun) => {
  return new Promise((resolve, reject) => {
    console.log("Updating SIMs to issuer organisation", orgId, "...");
    let simsProcessed = 0;
    simIds.forEach(function (simId, index, array) {
      if (dryRun) {
        console.log('DRY RUN: Would have updated simId', simId, 'to issuer organisation', orgId);
        return resolve(true);
      } else {

        let body = {
          'issuer_org': {
            'id': parseInt(orgId)
          }
        };

        throttledRequest({
          method: 'PATCH',
          uri: API_URL + "/sim/" + simId,
          'auth': {
            'bearer': masterToken
          },
          'body': body,
          json: true
        }, function (err, res, body) {
          if (res.statusCode === 204) {
            console.log('Updated simId', simId, 'to issuer organisation', orgId);
          } else if (err) {
            console.log("Error updating simId", simId, err, body);
          } else {
            console.log("Errorcode", res.statusCode, "occured while updating SIM with id", simId, body);
          }
          simsProcessed++;
          if (simsProcessed === array.length) {
            console.log("All done, great!");
            return resolve(true);
          }
        });
      }
    });
  });
}

const run = async () => {
  try {
    const answers = await askQuestions();
    const masterAuthToken = await authenticate(answers.MASTERTOKEN);
    const listOfIdentifiers = await readCsvFile(answers.FILEPATH);
    const arrayOfSimIds = await getArrayOfSimIds(listOfIdentifiers, answers.IDENTIFIER, masterAuthToken);
    const status = updateAllSimsOrgId(arrayOfSimIds, answers.DESTORGID, masterAuthToken, answers.DRYRUN);
  } catch (err) {
    console.error(err);
  };
};

run();