import { React, useState, useEffect } from "react";
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import AdminLogin from './AdminLogin.jsx';
import AdminInterface from './AdminInterface.jsx';

export default function AdminView() {
    const [username, setUsername] = useState(null);
    const [password, setPassword] = useState(null);
    const [status, setStatus] = useState(null);
    const [sessions, setSessions] = useState(null);
    const [collections, setCollections] = useState(null);

    const joinSession = (username, password, status) => {
        setUsername(username);
        setPassword(password);
        setStatus(status);
    };
    function customSortCollections(a, b) {
        const getIdNumber = (str) => parseInt(str.split('_')[1]);

        const aIdNumber1 = getIdNumber(a.id);
        const bIdNumber1 = getIdNumber(b.id);

        if (aIdNumber1 !== bIdNumber1) {
            return aIdNumber1 - bIdNumber1;
        }

        const aIdNumber2 = parseInt(a.id.split('_')[0]);
        const bIdNumber2 = parseInt(b.id.split('_')[0]);

        return aIdNumber2 - bIdNumber2;
    }
    function customSortQuestions(a, b) {
        const getIdNumber = (str) => {
            const match = str.match(/_(\d+):?/);
            return match ? parseInt(match[1]) : 0;
        };

        const aPromptNumber = getIdNumber(a);
        const bPromptNumber = getIdNumber(b);

        return aPromptNumber - bPromptNumber;
    }
    // Función para realizar una solicitud POST
    async function fetchSessionData() {
        const response = await fetch(`/api/session`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user: username,
                pass: password
            })
        });

        if (response.status === 200) {
            return await response.json();
        } else {
            const errorMsg = await response.text();
            throw new Error(errorMsg);
        }
    }

    // Función para realizar una solicitud GET
    async function fetchCollectionData() {
        const response = await fetch(`/api/collection`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });

        if (response.status === 200) {
            return await response.json();
        } else {
            const errorMsg = await response.text();
            throw new Error(errorMsg);
        }
    }

    // Lógica para ordenar las colecciones y preguntas
    function processCollections(data) {
        const collectionEntries = Object.entries(data);
        collectionEntries.sort((a, b) => customSortCollections({ id: a[0] }, { id: b[0] }));

        const sortedCollections = Object.fromEntries(collectionEntries);

        for (const collectionKey in sortedCollections) {
            if (sortedCollections.hasOwnProperty(collectionKey)) {
                const sortedQuestions = [...sortedCollections[collectionKey]].sort(customSortQuestions);
                sortedCollections[collectionKey] = sortedQuestions;
            }
        }

        return sortedCollections;
    }

    useEffect(() => {
        async function fetchData() {
            if (status != null) {
                try {
                    const sessionData = await fetchSessionData();
                    setSessions(sessionData);

                    const collectionData = await fetchCollectionData();
                    if (collectionData) {
                        const sortedCollections = processCollections(collectionData);
                        setCollections(sortedCollections);
                    }
                } catch (error) {
                    console.log(error);
                }
            }
        }

        fetchData();
    }, [status]);

    const handleSessionCreated = (newSession) => {
        setSessions([...sessions, newSession]);
    }
    return (
        <Container component="main" maxWidth="l">
            <Backdrop
                sx={{
                    backgroundColor: 'white',
                    zIndex: (theme) => theme.zIndex.drawer + 1,
                }}
                open={status == null}
            >
                <AdminLogin
                    onJoinSession={joinSession}
                />
            </Backdrop>

            <Box
                component="main"
                height='100vh'
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <AdminInterface
                    username={username}
                    password={password}
                    collections={collections}
                    sessions={sessions}
                    onSessionCreated={handleSessionCreated}
                />
            </Box>
        </Container>
    );
}

