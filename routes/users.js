const express = require('express');
const router = express.Router();
const users = require('../data');
const { checkID } = require('../data/users');
const { checkStr, checkEMail, checkNum, checkPassword, isPresent, checkAge, checkRating } = require('../errorHandling');
const { ObjectId } = require('mongodb');
const { status } = require('express/lib/response');
const xss = require('xss');

router.get('/', async (req, res) => {
    if (req.session.user) {
        res.redirect('/feed');
    }
    else {
        res.render('render/home', {});
    }
})

router.get('/login', async (req, res) => {
    if (req.session.user) {
        res.redirect('/feed');
    }
    else {
        res.render('render/login', {})
    }
})

router.post('/login', async (req, res) => {
    let email = xss(req.body.email);
    let password = xss(req.body.password);
    try {
        email = checkStr(email, "Email");
        email = checkEMail(email);
        isPresent(password);
    } catch (e) {
        return res.status(400).render('render/login', { class: "error", msg: e });
    }
    try {
        const result = await users.login(email, password);
        if (result.authenticated === true) {
            req.session.user = result._id;
            res.redirect('/feed');
        }
    } catch (e) {
        return res.status(400).render('render/login', { class: "error", msg: e });
    }
})

router.get('/signup', async (req, res) => {
    if (req.session.user) {
        res.redirect('/feed');
    }
    else {
        res.render('render/signup', {})
    }
})

router.post('/signup', async (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    let firstName = xss(req.body.firstName);
    let lastName = xss(req.body.lastName);
    let email = xss(req.body.email);
    let password = xss(req.body.password);
    let confirmPassword = xss(req.body.confirmPassword);
    let gender = xss(req.body.gender);
    let city = xss(req.body.city);
    let state = xss(req.body.state);
    let age = xss(req.body.age);
    try {
        firstName = checkStr(firstName, "First Name");
        lastName = checkStr(lastName, "Last Name");
        email = checkStr(email, "Email");
        email = checkEMail(email);
        isPresent(password, "Password");
        isPresent(confirmPassword, "Password");
        if (password !== confirmPassword) return res.status(400).render('render/signup', { class: "error", msg: "Passwords do not match" });
        checkPassword(password);
        gender = checkStr(gender, "Gender");
        city = checkStr(city, "City");
        state = checkStr(state, "State");
        age = checkNum(age, "Age");
        checkAge(age);
    } catch (e) {
        return res.status(400).render('render/signup', { class: "error", msg: e });
    }
    try {
        const result = await users.signUp(firstName, lastName, email, password, gender, city, state, age);
        if (result.userInserted === true) {
            req.session.user = result._id;
            res.redirect('/feed');
        }
    } catch (e) {
        return res.status(400).render('render/signup', { class: "error", msg: e });
    }
})

router.get('/feed', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        res.render('render/feed', {});
    };
})

router.get('/logout', async (req, res) => {
    req.session.destroy();
    res.redirect('/');
})

router.post('/postreview', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        let data = req.body;
        let { title, category, review, rating } = data;
        data.userID = req.session.user;
        // error checking
        try {
            title = checkStr(title, "Title");
            category = checkStr(category, "Category");
            review = checkStr(review, "Review");
            rating = checkNum(rating, "Rating");
            checkRating(rating);
            const result = await users.postReview(data);
            return res.status(200).json(result);
        } catch (e) {
            return res.status(400).json({ error: e });
        }
    }
})

router.get('/getallreviews', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        const data = await users.getAllReviews()
        return res.status(200).json({ data: data, userID: req.session.user });
    }
})

router.get('/getreview/:id', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        try {
            let reviewPost = await users.getReviews(req.params.id);
            const currUserData = await users.getUser(req.session.user);
            return res.status(200).json({ data: reviewPost, currUser: currUserData });
        } catch (e) {
            return res.status(400).json({ error: e });
        }
    }
})

router.post('/updatereview', async (req, res) => {
    if (!req.session.user) {
        return res.status(400).json("Invalid Request");
    }
    else {
        if (!('likes' in req.body)) req.body['likes'] = {};
        if (!('comments' in req.body)) req.body['comments'] = [];
        for (let i = 0; i < req.body.comments.length; i += 1) {
            req.body.comments[i][0] = xss(req.body.comments[i][0]);
        }
        let result = await users.updateReview(req.body);
        return res.status(200).json("Success");
    }
})

router.get('/review/:idNumber', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        try {
            let reviewPost = await users.getReviews(req.params.idNumber);
            // prevent blocked users from seeing the post
            const data = await users.getUser(reviewPost.userID);
            if (req.session.user in data.blockedUsers) return res.status(400).render('render/reviewNotFound');
            // reviewPost.postedDate = new Date(reviewPost.postedDate).toLocaleString('English', { hour12: false });
            res.render('render/review', { reviewId: req.params.idNumber });
        } catch (e) {
            return res.status(400).render('render/reviewNotFound');
        }
    }
});

router.post('/review/search', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        try {
            checkStr(xss(req.body.text));
            let thread = await users.getReviewTitle(xss(req.body.text));
            if (thread == -1) {
                return res.status(200).json({ error: "Review Not Found" });
            }
            return res.status(200).json({ threadId: thread._id.toString(), threadTitle: thread.title });
        } catch (e) {
            return res.status(400).json({ error: e });
        }
    }
})

router.post('/review/newComment', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        try {
            let userId = ObjectId(req.session.user).toString();
            let newComment = await users.postReviewComments(ObjectId(xss(req.body.postId)).toString(), userId, xss(req.body.comment));
            if (newComment) {
                res.json({ status: 'ok' });
            }
        } catch (e) {
            return res.status(400).json({ error: e });
        }
    }
});


router.get('/userinfo/*', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        try {
            const id = req.params['0'];
            const data = await users.getUser(id);
            const currUserData = await users.getUser(req.session.user);
            if (req.session.user in data.blockedUsers) return res.status(400).render('render/userNotFound');
            const userInfo = {
                data: data,
                currUser: currUserData
            };
            res.render('render/userInfo', userInfo);
        } catch (e) {
            return res.status(400).render('render/userNotFound');
        }
    }
})

router.post('/userinfo/*', async (req, res) => {
    if (!req.session.user) {
        return res.status(400);
    }
    else {
        try {
            const id = req.params['0'];
            const data = await users.getUser(id);
            const currUserData = await users.getUser(req.session.user);
            if (req.session.user in data.blockedUsers) return res.status(404).json({ error: `User not found` });
            const userInfo = {
                data: data,
                currUser: currUserData
            };
            return res.status(200).json(userInfo);
        } catch (e) {
            return res.status(404).json({ error: `User not found` });
        }
    }
})

router.get('/editprofile', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        res.render('render/editProfile', {});
    }
})

router.post('/editprofile', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    let firstName = xss(req.body.firstName.trim());
    let lastName = xss(req.body.lastName.trim());
    let email = xss(req.body.email.trim());
    let password = xss(req.body.password);
    let confirmPassword = xss(req.body.confirmPassword);
    let gender = xss(req.body.gender.trim());
    let city = xss(req.body.city.trim());
    let state = xss(req.body.state.trim());
    let age = xss(req.body.age.trim());
    let updateParams = {};
    try {
        if (firstName.length !== 0) {
            firstName = checkStr(firstName, "First Name");
            updateParams.firstName = firstName;
        }
        if (lastName.length !== 0) {
            lastName = checkStr(lastName, "Last Name");
            updateParams.lastName = lastName;
        }
        if (email.length !== 0) {
            email = checkStr(email, "Email");
            email = checkEMail(email);
            updateParams.email = email;
        }
        if (password.length !== 0) {
            isPresent(password, "Password");
            isPresent(confirmPassword, "Password");
            if (password !== confirmPassword) return res.status(400).render('render/editProfile', { class: "error", msg: "Passwords do not match" });
            checkPassword(password);
            updateParams.password = password;
        }
        if (gender.length !== 0) {
            gender = checkStr(gender, "Gender");
            updateParams.gender = gender;
        }
        if (city.length !== 0) {
            city = checkStr(city, "City");
            updateParams.city = city;
        }
        if (state.length !== 0) {
            state = checkStr(state, "State");
            updateParams.state = state;
        }
        if (age.length !== 0) {
            age = checkNum(age, "Age");
            checkAge(age);
            updateParams.age = age;
        }
        if (Object.keys(updateParams).length === 0) return res.status(400).render('render/editProfile', { class: "error", msg: "Nothing to update." });
        let result = await users.updateUser(updateParams, req.session.user);
        return res.status(200).render('render/editProfile', { msg: "Successfully updated personal information." })
    } catch (e) {
        return res.status(400).render('render/editProfile', { class: "error", msg: e });
    }

})


router.get('/myprofile', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        return res.redirect(`/userinfo/${req.session.user}`);
    }
})


router.post('/updatefriends', async (req, res) => {
    if (!req.session.user) {
        return res.status(401);
    }
    else {
        let result = await users.updateFriends(req.body);
        return res.status(200).json("Success");
    }
})

router.get('/friendrequests', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        res.render('render/friendRequests', { currUser: req.session.user });
    }
})

router.get('/threads', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        threadLs = await users.getAllThreads();
        res.render('render/thread', { threadList: threadLs });
    };
})

router.get('/myfriends', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        res.render('render/myFriends', { currUser: req.session.user });
    }
})

router.get('/allthreads', async (req, res) => {
    if (!req.session.user) {
        return res.status(400);
    }
    else {
        const result = await users.getAllThreads();
        return res.status(200).json(result);
    }
})

router.post('/threads', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        userID = req.session.user;
        // error checking
        try {
            let title = checkStr(xss(req.body.title), "Title");
            let text = checkStr(xss(req.body.text), "Text");
            const d = new Date();
            let day = `${d.getDate() + 1}`;
            if (day < 10) day = "0".concat(day);
            let month = `${d.getMonth() + 1}`;
            if (month < 10) month = "0".concat(month);
            let date = `${d.getFullYear()}/${month}/${day}`;
            const result = await users.postThread(title, date, text, 0, userID);
            threadLs = await users.getAllThreads();
            return res.status(200).render('render/thread', { threadList: threadLs });
        } catch (e) {
            return res.status(400).render('render/thread', { threadList: threadLs, error: e });
        }
    }
})

router.get('/thread/:id', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        try {
            users.checkID(req.params.id);
            let thread = await users.getThreadId(req.params.id);
            return res.status(200).render('render/threadId', thread);
        } catch (e) {
            return res.status(404).render('render/threadNotFound', {});
        }
    }
})

router.get('/getThread/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(400);
    }
    else {
        try {
            users.checkID(req.params.id);
            let thread = await users.getThreadId(req.params.id);
            return res.status(200).json(thread);
        } catch (e) {
            return res.status(400).json({ error: e });
        }
    }
})

router.post('/thread/:id/comment', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        try {
            users.checkID(req.params.id);
            checkStr(xss(req.body.text));
            let comment = await users.postThreadComment(xss(req.body.text), req.params.id, req.session.user);
            return res.status(200).json({ userName: comment.userName, comment: comment.comment });
        } catch (e) {
            return res.status(400).json({ error: e });
        }
    }
})

router.post('/thread/search', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        try {
            checkStr(xss(req.body.searchText));
            let thread = await users.getThreadTitle(xss(req.body.searchText));
            if (thread == -1) {
                return res.status(200).json({ error: "Thread Not Found" });
            }
            return res.status(200).json({ threadId: thread._id.toString(), threadTitle: thread.title });
        } catch (e) {
            return res.status(400).json({ error: e });
        }
    }
})

router.post('/thread/:id/like', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        try {
            users.checkID(req.params.id);
            let voting = await users.postThreadLike(req.params.id, req.session.user, 1);
            return res.status(200).json({ voting: voting });
        } catch (e) {
            return res.status(400).json({ error: e });
        }
    }
})

router.post('/thread/:id/dislike', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        try {
            users.checkID(req.params.id);
            let voting = await users.postThreadLike(req.params.id, req.session.user, -1);
            return res.status(200).json({ voting: voting });
        } catch (e) {
            return res.status(400).json({ error: e });
        }
    }
})

router.get('/blockedusers', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    else return res.status(200).render('render/blockedUsers', {});
})

router.get('/getinfo', async (req, res) => {
    if (!req.session.user) {
        return res.status(400);
    }
    else {
        const data = await users.getUser(req.session.user);
        return res.status(200).json(data);
    }
})

router.get('/savedreviews', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    else return res.status(200).render('render/savedReviews', {});
})

router.post('/deletepost', async (req, res) => {
    if (!req.session.user) return res.status(400);
    else {
        let postID = xss(req.body.postID);
        let user = req.body.user;
        if (user._id != req.session.user) return res.status(400);
        const result = await users.deletePost(postID);
        return res.status(200).json({ msg: "Success" });
    }
})

router.post('/blockUpdates', async (req, res) => {
    if (!req.session.user) return res.status(400);
    else {
        let currUser = req.body.currUser;
        let blockedUser = req.body.blockedUser;
        const result = await users.blockUpdates(currUser, blockedUser);
        return res.status(200).json({ msg: "Success" });
    }
})

router.get('/popularData', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        try {
            let data = await users.popularPage();
            res.json({
                data: data
            });
        } catch (e) {
            return res.status(400).json({ error: e });
        }

    }
});

router.get('/popular', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    else {
        res.render('render/popular', {});
    }
})

router.post('/deletethread', async (req, res) => {
    if (!req.session.user) return res.status(400);
    else {
        let threadID = xss(req.body.threadID);
        let user = req.body.user;
        if (user._id != req.session.user) return res.status(400);
        const result = await users.deleteThread(threadID, user._id);
        return res.status(200).json({ msg: "Success" });
    }
})


module.exports = router;