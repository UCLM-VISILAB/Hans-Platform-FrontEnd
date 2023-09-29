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
    useEffect(() => {
        if (status != null) {
            fetch(
                `/api/session`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(
                        {
                            user: username,
                            pass: password
                        }
                    )
                }
            ).then(res => {
                if (res.status === 200) {
                    res.json().then(data => {
                        setSessions(data);
                    });
                } else {
                    res.text().then(msg => console.log(msg));
                }
            }).catch(error => {
                console.log(error);
            });
            fetch(
                `/api/collection`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    }
                }
            ).then(res => {
                if (res.status === 200) {
                    res.json().then(data => {
                        if (data) {
                            const collectionEntries = Object.entries(data);
                
                            // Ordena el arreglo de pares clave-valor utilizando customSortCollections
                            collectionEntries.sort((a, b) => customSortCollections({ id: a[0] }, { id: b[0] }));
                
                            // Crea un nuevo objeto a partir del arreglo ordenado de pares clave-valor
                            const sortedCollections = Object.fromEntries(collectionEntries);
                
                            for (const collectionKey in sortedCollections) {
                                if (sortedCollections.hasOwnProperty(collectionKey)) {
                                    const sortedQuestions = [...sortedCollections[collectionKey]].sort(customSortQuestions);
                                    sortedCollections[collectionKey] = sortedQuestions;
                                }
                            }
                            setCollections(sortedCollections);
                        }
                    });
                } else {
                    res.text().then(msg => console.log(msg));
                }
            }).catch(error => {
                console.log(error);
            });

        }
         // eslint-disable-next-line
    }, [status]);

    const handleSessionCreated = (newSession) => {
        setSessions([...sessions, newSession]);
    }

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
                ></AdminInterface>
            </Box>
        </Container>


    );
}