'use strict'

const {equal}        = require('node:assert')
const {readFileSync} = require('node:fs')
const {join}         = require('node:path')
const {readHeaders}  = require('../index')

const filepath = join(__dirname, 'data/holder-nix.tar')
const tarball  = readFileSync(filepath)
const headers  = readHeaders(tarball)

equal(headers.length, 6, 'headers count match')

equal(headers[0].name, 'holder/', 'directory header name match')

equal(headers[1].name, 'holder/hello.txt', 'file header name match')
