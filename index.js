/// <reference path="./types/index.d.ts" />
const { CSGOGSI } = require('csgogsi');
const { DOTA2GSI } = require('dotagsi');
const fs = require('fs');
const path = require('path');
/**
 * This is config-generating function - it starts before the onStart callback, and decides how does the settings for addon look like.
 * Because it's async and first function to be called, it can fetch data from 3rd party APIs to help building settings panel.
 */
loadConfig(async () => {
    const config = [
        {
            name: "leftTeam",
            type: "team",
            label: "Select Left Team"
        },
        {
            name: "rightTeam",
            type: "team",
            label: "Select Right Team"
        },
        {
            name: "womenTeams",
            type: "checkbox",
            label: "Women Teams"
        },
        {
            name: "dotaTeams",
            type: "checkbox",
            label: "Dota Teams"
        },
        {
            name: "buttonAction",
            type: "action",
            values: [
                {
                    name: "action1",
                    label: "Click Here!"
                }
            ]
        }
    ]

    return config;
});


/**
 * onStart runs after loadConfig()
 * config: inital values for the config, empty or filled with the values of the last run
 * close: force-closes the addon, initiates onClose()'s callback
 * onConfigChange: listens for change in the config
 * CSGOGSI: GSI Event Listener Instance
 */
onStart(async ({ CSGOGSI, DOTAGSI, config, close, onConfigChange, onAction }) => {
    const rounds = [];


    onAction("buttonAction", data => {
        console.log(CSGOGSI.current)
        console.log(DOTAGSI.last)
        // const players = CSGOGSI.current?.players;

        // if (!players || players.length === 0) {
        //     console.log("No players available.");
        //     return;
        // }

        // const outputPath = path.join(__dirname, "players_dump.json");
        // try {
        //     fs.writeFileSync(outputPath, JSON.stringify(players, null, 2), 'utf-8');
        //     console.log(`Players written to ${outputPath}`);
        // } catch (err) {
        //     console.error("Failed to write players file:", err);
        // }
    });

    /**
     * Accessing inital config
     */
    let targetPlayerSteamId = config?.targetPlayer?.player?.steamid;
    // let leftTeamName = config?.leftTeam?.team?.name;
    // let rightTeamName = config?.rightTeam?.team?.name;
    // let womenTeams = config?.womenTeams;

    let freezetimeSent = false
    let last_round_phase = "undefined"
    const flashedPlayers = {}

    // console.log("Left team name ", leftTeamName)
    /**
     * You can listen for changes in config while addon is running
     */
    onConfigChange(newConfig => {
        const leftTeamName = newConfig?.leftTeam?.team?.name;
        const rightTeamName = newConfig?.rightTeam?.team?.name;
        const womenTeams = newConfig?.womenTeams
        const dotaTeams = newConfig?.dotaTeams
        const body = {
            dota_teams: dotaTeams,
            women_teams: womenTeams,
            left: {
                name: leftTeamName,
                players: [] // Add actual player data here if needed
            },
            right: {
                name: rightTeamName,
                players: [] // Add actual player data here if needed
            }
        };
        console.log(womenTeams)
        fetch("http://localhost:8085/team/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }).catch(console.error);
    });

    const generateTable = () => {
        let content = 'Round   |   Player\n';
        content += '-----------------------\n';

        for (const round of rounds) {
            content += `${`${round.round}`.padEnd(8)}| ${round.player}`;

            if (round.steamid === targetPlayerSteamId) {
                content += ' (Very good player)';
            }

            content += '\n';
        }

        return content;
    }

    /**
     * Because this is server environment, addon can make any sort of calls, including MIDI, ATEM, fetches, companion integrations etc.
     * With that, creating stage integration or automating any other part of your system should be very easy.
     * In this case, we store information on who was the MVP of every round, and then dump it to a file
     */

    // CSGOGSI.on("mvp", (player) => {
    //     const current = CSGOGSI.current;
    //     if(!current) return;

    //     rounds.push({
    //         player: player.name,
    //         steamid: player.steamid,
    //         round: current.round?.phase === "over" ? current.map.round : current.map.round + 1
    //     });

    //     fs.writeFileSync(path.join(__dirname, "./mvps.json"), generateTable(), 'utf-8');
    // });

    CSGOGSI.on("freezetimeStart", () => {
        fetch('http://localhost:8085/round/start', { method: "POST" });
    });

    CSGOGSI.on("warmupStart", () => {
        console.log("Warmup start");
    });

    CSGOGSI.on("timeoutStart", () => {
        console.log("TimeoutStart");
    });

    CSGOGSI.on("kill", (kill) => {
        if (!kill || !kill.victim) return;

        // console.log("Kill event received:", kill);

        const body = {
            name: kill.victim?.name || null,
            steamid: kill.victim?.steamid,
            timestamp: Date.now()
        };

        fetch("http://localhost:8085/player/death", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }).catch(console.error);
    });

    CSGOGSI.on("bombPlant", () => {
        fetch('http://localhost:8085/bomb/planted', { method: "POST" });
    });

    CSGOGSI.on("bombExplode", () => {
        fetch('http://localhost:8085/bomb/exploded', { method: "POST" });
    });

    CSGOGSI.on("bombDefuse", () => {
        fetch('http://localhost:8085/bomb/defused', { method: "POST" });
    });

    CSGOGSI.on("roundEnd", () => {
        console.log(CSGOGSI.current?.bomb)
        fetch('http://localhost:8085/round/end', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                map: CSGOGSI.current?.map,
                round: CSGOGSI.current?.round,
                bomb: CSGOGSI.current?.bomb,
                timestamp: Date.now()
            })
        });
        freezetimeSent = false;
    });

    CSGOGSI.on("matchEnd", () => {
        fetch('http://localhost:8085/match/end', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                map: CSGOGSI.current?.map,
                round: CSGOGSI.current?.round,
                bomb: CSGOGSI.current?.bomb,
                timestamp: Date.now()
            })
        });
    });

    CSGOGSI.on("data", () => {
        const round_phase = CSGOGSI.current?.round?.phase
        if (round_phase == "freezetime" && round_phase != last_round_phase) {
            fetch('http://localhost:8085/round/start', { method: "POST" });
            console.log("send Freezetime");
        }
        last_round_phase = round_phase

        const players = CSGOGSI.current?.players || []
        players.forEach(player => {
            const steamid = player.steamid
            if (!steamid) return
            const isFlashed = player.state?.flashed > 0
            const wasFlashed = flashedPlayers[steamid] || false
            if (isFlashed && !wasFlashed) {
                flashedPlayers[steamid] = true
                const body = {
                    name: player.name,
                    steamid: player.steamid,
                    timestamp: Date.now()
                }
                fetch("http://localhost:8085/player/flashed", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                }).catch(console.error)
            } else if (!isFlashed && wasFlashed) {
                flashedPlayers[steamid] = false
                const body = {
                    name: player.name,
                    steamid: player.steamid,
                    timestamp: Date.now()
                }
                fetch("http://localhost:8085/player/unflashed", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                }).catch(console.error)
            }
        })
    });


    DOTAGSI.on("kill", kill => {
        if (!kill || !kill.victim) return

        const body = {
            name: kill.victim?.name || null,
            steamid: kill.victim?.steamid,
            timestamp: Date.now()
        }
        console.log("a player was killed");
        fetch("http://localhost:8085/player/death", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }).catch(console.error)
    })

    let lastRoshanKillTime = null
    let lastRoshanAlive = null
    const heroAliveStatus = {}

    DOTAGSI.on("data", dota => {
        const events = dota.events || []
        events.forEach(event => {
            if (event.event_type === "roshan_killed") {
                if (event.game_time === lastRoshanKillTime) return
                lastRoshanKillTime = event.game_time

                const body = {
                    team: event.killed_by_team,
                    timestamp: Date.now()
                }
                fetch("http://localhost:8085/roshan/killed", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                }).catch(console.error)
            }
        })

        const roshanAlive = dota.roshan?.alive
        if (roshanAlive !== undefined && lastRoshanAlive !== null) {
            if (roshanAlive && !lastRoshanAlive) {
                lastRoshanKillTime = null
                fetch("http://localhost:8085/roshan/respawn", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ timestamp: Date.now() })
                }).catch(console.error)
            }
        }
        if (roshanAlive !== undefined) {
            lastRoshanAlive = roshanAlive
        }

        const players = dota.players || []
        players.forEach(player => {
            const alive = player.hero?.alive
            const prevAlive = heroAliveStatus[player.steamid]
            if (alive && prevAlive === false) {
                const body = {
                    name: player.name,
                    steamid: player.steamid,
                    timestamp: Date.now()
                }
                fetch("http://localhost:8085/player/respawn", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                }).catch(console.error)
            }
            heroAliveStatus[player.steamid] = alive
        })
    })
});

/**
 * Clean-up function, needs to handle clearing all of the event listeners, servers, connections, perform final dump, etc
 */
onClose(({ CSGOGSI, config }) => {
    CSGOGSI.removeAllListeners("bombExplode");
    CSGOGSI.removeAllListeners("data");
});
