"use strict";

const {equal}        = require("assert");
const {readFileSync} = require("fs");
const {join}         = require("path");
const {readHeaders}  = require("../index");

const filepath = join(__dirname, "data/holder.tar");
const tarball  = readFileSync(filepath);
const headers  = readHeaders(tarball);

equal(headers.length, 6, "headers count match");

equal(headers[0].name, "holder/", "directory header name match");
equal(headers[0].size, 0, "directory header size match");
equal(headers[0].typeflag, "5", "directory header typeflag match");

equal(headers[1].name, "holder/hello.txt", "file header name match");
equal(headers[1].size, 15, "file header size match");
equal(headers[1].typeflag, "0", "file header typeflag match");
