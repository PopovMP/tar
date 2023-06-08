"use strict";

const {join}         = require("path");
const {readFileSync} = require("fs");
const {extract}      = require("../index");

const tarPath = join(__dirname, "data/holder.tar");
const tarball = readFileSync(tarPath);

const destination = join(__dirname, "data");

extract(tarball, destination);
