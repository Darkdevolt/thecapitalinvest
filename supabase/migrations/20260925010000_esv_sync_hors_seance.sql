-- tc-esv-sync (10:10 et 15:10 UTC) dépassait systématiquement les 55 s en
-- séance, brvm.org répondant alors en 12 à 40 s par page (aucun passage
-- journalisé le 24/09). Déplacé hors séance (07:10 et 20:10 UTC), en complément
-- du cron Vercel de 18:00 qui, lui, aboutit chaque jour.
select cron.alter_job(jobid, schedule := '10 7,20 * * *') from cron.job where jobname = 'tc-esv-sync';
