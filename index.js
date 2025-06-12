/// <reference path="./types/index.d.ts" />
const fs = require('fs');
const path = require('path');
/**
 * This is config-generating function - it starts before the onStart callback, and decides how does the settings for addon look like.
 * Because it's async and first function to be called, it can fetch data from 3rd party APIs to help building settings panel.
 */
loadConfig(async () => {
    const config = [
        {
            name: "targetPlayer",
            type: "player",
            label: "Target player for info dump"
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
onStart(async ({ CSGOGSI, config, close, onConfigChange, onAction }) => {
    const rounds = [];


    onAction("buttonAction", data => {
        console.log("Data from action button:", {data});
    })

    /**
     * Accessing inital config
     */
    let targetPlayerSteamId = config?.targetPlayer?.player?.steamid;

    /**
     * You can listen for changes in config while addon is running
     */
    onConfigChange(newConfig => {
        targetPlayerSteamId = newConfig?.targetPlayer?.player?.steamid;
    });

    const generateTable = () => {
        let content = 'Round   |   Player\n';
        content    += '-----------------------\n';

        for(const round of rounds){
            content += `${`${round.round}`.padEnd(8)}| ${round.player}`;

            if(round.steamid === targetPlayerSteamId) {
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

    // ✅ Listen for raw MIRV messages
    window.addEventListener("message", (event) => {
        const data = event.data;

        if (data?.event?.name === "player_death") {
            const kill = CSGOGSI.digestMIRV(data, "player_death");
            if (!kill || !kill.victim) return;

            console.log("Kill:", kill);

            fetch("http://localhost:8085/player/death", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    victim: kill.victim.name,
                    steamid: kill.victim.steamid,
                    weapon: kill.weapon,
                    killer: kill.killer?.name || null,
                    headshot: kill.headshot,
                    timestamp: Date.now()
                })
            }).catch(console.error);
        }

        if (data?.event?.name === "player_hurt") {
            const hurt = CSGOGSI.digestMIRV(data, "player_hurt");
            if (hurt) {
                console.log("Hurt:", hurt);
                // You could POST this to a /player/hurt endpoint if needed
            }
        }
    });

    CSGOGSI.on("bombExplode", () => {
        fetch('http://localhost:8085/bomb/exploded', { method: "POST" });
    });

    CSGOGSI.on("bombPlant", () => {
        fetch('http://localhost:8085/bomb/planted', { method: "POST" });
    });

    CSGOGSI.on("bombPlantStart", () => {
        fetch('http://localhost:8085/bomb/planting', { method: "POST" });
    });

    CSGOGSI.on("defuseStart", () => {
        fetch('http://localhost:8085/bomb/defusing', { method: "POST" });
    });

    CSGOGSI.on("roundEnd", () => {
        const winner_side = CSGOGSI.current?.round?.win_team;
        const winner_name = winner_side === 'CT'
            ? CSGOGSI?.current?.map?.team_ct?.name
            : CSGOGSI?.current?.map?.team_t?.name;

        console.log("Winner name: ", { winner_name });

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
    });
});

/**
 * Clean-up function, needs to handle clearing all of the event listeners, servers, connections, perform final dump, etc
 */
onClose(({ CSGOGSI, config }) => {
    CSGOGSI.removeAllListeners("bombExplode");
    CSGOGSI.removeAllListeners("data");
});
