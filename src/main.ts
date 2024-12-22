import { spawn } from 'node:child_process'
import core from '@actions/core'

import { getConfig } from './config'

export default async function main(): Promise<void> {
    const { binary } = await getConfig()
    core.debug(`ZLint binary: ${binary}`)

    const child = spawn(binary, ['--format', 'github'], {
        stdio: 'inherit',
        env: process.env,
        cwd: process.cwd(),
    })

    await new Promise((resolve, reject) => {
        let done = false

        function fail(message: string | Error) {
            done = true
            core.setFailed(message)
            child.removeAllListeners()
            reject(message)
        }

        child.on('error', err => {
            if (done) core.error(err)
            else fail(err)
        })

        child.on('exit', (code, signal) => {
            if (code !== 0) {
                if (done) {
                    core.error(`ZLint exited with code ${code} and signal ${signal}`)
                    return
                }
                fail(`ZLint exited with code ${code} and signal ${signal}`)
            }
        })
    })
}
