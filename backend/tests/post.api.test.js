const { api, auth, createAuthUser } = require("./helpers/apiTestUtils");

describe("Post API", () => {
  test("creates, lists, likes, comments on, and soft-deletes posts", async () => {
    const author = await createAuthUser();
    const reader = await createAuthUser();

    const unauthorized = await api.post("/api/posts").send({ content: "No token" });
    expect(unauthorized.status).toBe(401);
    const invalid = await auth(api.post("/api/posts"), author.token).send({ content: "" });
    expect(invalid.status).toBe(400);

    const created = await auth(api.post("/api/posts"), author.token).send({
      content: "Match day update",
      type: "text"
    });
    expect(created.status).toBe(201);
    const postId = created.body.post._id;

    const listed = await api.get("/api/posts?page=1&limit=5");
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    const userPosts = await api.get(`/api/posts/user/${author.user._id}`);
    expect(userPosts.status).toBe(200);
    expect(userPosts.body.data).toHaveLength(1);

    const liked = await auth(api.post(`/api/posts/${postId}/like`), reader.token).send({});
    expect(liked.status).toBe(200);
    expect(liked.body.likes).toBe(1);
    const unliked = await auth(api.post(`/api/posts/${postId}/like`), reader.token).send({});
    expect(unliked.body.likes).toBe(0);

    const commented = await auth(api.post(`/api/posts/${postId}/comment`), reader.token).send({
      text: "Good luck"
    });
    expect(commented.status).toBe(200);
    expect(commented.body.comments).toHaveLength(1);

    const forbidden = await auth(api.delete(`/api/posts/${postId}`), reader.token);
    expect(forbidden.status).toBe(403);
    const deleted = await auth(api.delete(`/api/posts/${postId}`), author.token);
    expect(deleted.status).toBe(200);
    const afterDelete = await api.get("/api/posts");
    expect(afterDelete.body.data).toHaveLength(0);
  });
});
