import { spawn, type ChildProcess } from 'node:child_process'
import core from '@actions/core'
import gh from '@actions/github'
import { exec } from '@actions/exec'

import { getConfig } from './config'

export default async function main(): Promise<void> {
    const { binary, diffOnly } = await getConfig()
    core.debug(`ZLint binary: ${binary}`)

    let child: ChildProcess

    if (diffOnly && gh.context.eventName.startsWith('pull_request')) {
        const code = await fetchBaseRef()
        if (code !== 0) throw new Error('Failed to fetch base branch: fetch exited with code ' + code)
        child = zlintGitDiff(binary)
    } else {
        child = zlint(binary)
    }

    await new Promise<void>((resolve, reject) => {
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
            } else if (!done) {
                done = true
                resolve()
            }
        })
    })
}

function zlint(binary: string): ChildProcess {
    return spawn(binary, ['--format', 'github'], {
        stdio: 'inherit',
        env: process.env,
        cwd: process.cwd(),
    })
}

function zlintGitDiff(binary: string): ChildProcess {
    const baseRef = gh.context.payload.pull_request?.base.ref
    if (!baseRef) throw new Error('Could not determine base branch')
    const diff = spawn('git', ['diff', `${baseRef}...HEAD`, '--name-only'], {
        stdio: ['inherit', 'pipe', 'inherit'],
        env: process.env,
        cwd: process.cwd(),
    })

    const zlint = spawn(binary, ['--format', 'github', '--stdin'], {
        stdio: [diff.stdout, 'inherit', 'inherit'],
        env: process.env,
        cwd: process.cwd(),
    })

    diff.on('error', err => {
        zlint.kill()
        throw err
    })

    return zlint
}

function fetchBaseRef(): Promise<number> {
    const baseRef = gh.context.payload.pull_request?.base.ref
    if (!baseRef) throw new Error('Could not determine base branch')
    return exec('git', ['fetch', 'origin', `${baseRef}:${baseRef}`])
}
