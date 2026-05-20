import { Router, Request, Response } from 'express';
import { readDB, writeDB } from '../db.js';

const router = Router();
    router.post('/submit', (req: Request, res: Response) => {
        const db = readDB();
        const { title, description, submittedEmail } = req.body;
        const newGrant = {
            id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            title,
            description,
            submittedEmail: submittedEmail,
        };
        db.grants.push(newGrant);
        writeDB(db);
        res.status(201).json(newGrant);
    });


export default router;