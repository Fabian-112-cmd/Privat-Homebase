(async function () {
    const client = window.supabase.createClient(
        'https://fvdjuavvandzshepwjkb.supabase.co',
        'sb_publishable_8VG6wR9BkVhmLfZGnD-d1g_Fw6rK_sk',
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
                storageKey: 'privat-homebase-auth'
            }
        }
    );

    const card = document.querySelector('#apps .card');
    const values = card.querySelectorAll('.metric b');
    const status = card.querySelector('.status');

    const login = document.createElement('div');

    login.style.cssText = `
        position:fixed;
        inset:0;
        z-index:99999;
        background:linear-gradient(135deg,#172644,#65518d);
        display:grid;
        place-items:center;
        padding:20px;
    `;

    login.innerHTML = `
        <form id="homebase-login" style="
            background:#f5f4fc;
            color:#172644;
            padding:28px;
            border-radius:20px;
            width:100%;
            max-width:380px;
            box-sizing:border-box;
            text-align:center;
        ">
            <img src="homebase.svg" width="76" height="76">
            <h2>Privat Homebase</h2>
            <p>Meine persönliche Zentrale</p>

            <input id="hb-user" placeholder="Benutzername"
                autocomplete="username" required
                style="width:100%;padding:12px;margin:8px 0;
                border:1px solid #ddd;border-radius:10px">

            <input id="hb-password" type="password"
                placeholder="Passwort"
                autocomplete="current-password" required
                style="width:100%;padding:12px;margin:8px 0;
                border:1px solid #ddd;border-radius:10px">

            <button type="submit" style="
                width:100%;padding:13px;margin-top:12px;
                background:#7560c5;color:white;
                border:0;border-radius:10px;
                font-weight:bold;cursor:pointer">
                Anmelden
            </button>

            <p id="hb-error" role="alert"
                style="color:#b42318;font-size:13px"></p>
        </form>
    `;

    document.body.appendChild(login);

    const logout = document.createElement('button');
    logout.textContent = 'Abmelden';
    logout.style.cssText = `
        padding:10px 16px;
        border:0;
        border-radius:10px;
        background:#eee8fc;
        color:#172644;
        cursor:pointer;
        font-weight:bold;
        margin:16px 0;
    `;

    document.querySelector('main').appendChild(logout);

    let activeUser = null;
    let requestId = 0;

    function clearData() {
        requestId++;
        values.forEach(v => v.textContent = '—');
        status.textContent = 'Nicht verbunden';
    }

    async function loadData() {
        if (!activeUser) return;

        const id = ++requestId;
        status.textContent = 'Daten werden geladen …';

        try {
            const rows = [];
            let offset = 0;

            while (true) {
                const { data, error } = await client
                    .from('mein_leben_entries')
                    .select('kind,details,due_date')
                    .eq('user_id', activeUser)
                    .order('id')
                    .range(offset, offset + 499);

                if (error) throw error;
                if (id !== requestId) return;

                rows.push(...data);
                if (data.length < 500) break;
                offset += 500;
            }

            const today = new Date().toLocaleDateString(
                'sv-SE',
                { timeZone: 'Europe/Berlin' }
            );

            const counts = [
                rows.filter(r =>
                    r.kind === 'tasks' &&
                    r.details?.status !== 'Erledigt'
                ).length,

                rows.filter(r =>
                    r.kind === 'shopping' &&
                    r.details?.status !== 'Erledigt'
                ).length,

                rows.filter(r =>
                    r.kind === 'notes'
                ).length,

                rows.filter(r =>
                    r.kind === 'appointments' &&
                    r.due_date &&
                    r.due_date >= today
                ).length
            ];

            if (id !== requestId) return;

            values.forEach((v, i) => {
                v.textContent = counts[i];
            });

            status.textContent = 'Live verbunden ✓';
            status.style.color = '#16805d';

        } catch (error) {
            if (id !== requestId) return;
            clearData();
            status.textContent = 'Verbindung fehlgeschlagen';
            status.style.color = '#b42318';
        }
    }

    function updateSession(session) {
        clearData();
        activeUser = session?.user?.id || null;
        login.style.display = activeUser ? 'none' : 'grid';
        logout.hidden = !activeUser;

        if (activeUser) setTimeout(loadData, 0);
    }

    document.getElementById('homebase-login')
        .addEventListener('submit', async function (event) {
            event.preventDefault();

            const button = this.querySelector('button');
            const message = document.getElementById('hb-error');

            button.disabled = true;
            message.textContent = '';

            try {
                const username = document
                    .getElementById('hb-user').value.trim();

                const { data: email, error: lookupError } =
                    await client.rpc('app_login_email', {
                        p_username: username
                    });

                if (lookupError || !email) {
                    throw new Error('Anmeldung fehlgeschlagen');
                }

                const { error } =
                    await client.auth.signInWithPassword({
                        email,
                        password: document
                            .getElementById('hb-password').value
                    });

                if (error) throw error;

            } catch (error) {
                message.textContent =
                    'Bitte Benutzername und Passwort prüfen.';
            } finally {
                document.getElementById('hb-password').value = '';
                button.disabled = false;
            }
        });

    logout.onclick = async function () {
        const { error } = await client.auth.signOut({
            scope: 'local'
        });

        if (error) {
            alert('Abmeldung fehlgeschlagen.');
        }
    };

    client.auth.onAuthStateChange((_event, session) => {
        updateSession(session);
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && activeUser) loadData();
    });

    setInterval(() => {
        if (activeUser && !document.hidden) loadData();
    }, 60000);

})();
