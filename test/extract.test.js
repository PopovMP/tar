'use strict'

const {join}                     = require('node:path')
const {extractEntries}           = require('../index')
const {existsSync, readFileSync} = require('node:fs')

const tarPath     = join(__dirname, 'data/holder-win.tar')
const destination = join(__dirname, 'data')

extract(tarPath, destination)

/**
 * Extracts all files from a tar archive
 *
 * @param {string} filepath    - path to the tar archive
 * @param {string} destination - path to destination directory
 *
 * @return {void}
 */
function extract(filepath, destination)
{
	if (!existsSync(filepath))
		throw new Error(`cannot find tar archive: ${filepath}`)

	if (!existsSync(destination))
		throw new Error(`cannot open destination folder: ${destination}`)

	const tarball = readFileSync(filepath)

	extractEntries(tarball, destination)
}
