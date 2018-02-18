import * as passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import * as session from "express-session";
import * as md5 from "md5";

export class UserManagementAddon {
	signupParams: any[];
	options: { history: boolean; save: boolean; db: boolean };
	disabled: boolean;
	public static displayName = "User Management";
	public static logo = "http://i1.wp.com/wassimchegham.com/wp/wp-content/uploads/2015/10/138338bc-7806-11e5-8057-d34c75f3cafc.png?w=1272";

	public static installSettings = false;

	constructor(private app: any, private config: any, private express: any) {
		if (!this.config || !this.config.type) {
			this.disabled = true;
		}
		express.use(passport.initialize());
		express.use(passport.session());
	}

	afterLoadEntities() {
		if (this.disabled) {
			return Promise.resolve();
		}

		const userEntity = this.app.entities.get("user");
		const res = [];
		this.options = {
			history: false,
			save: false,
			db: false
		};
		this.signupParams = [];
		if (this.config.type == "email" || this.config.type == "both") {
			res.push(
				userEntity.addField(
					{
						name: "email",
						type: "text",
						required: true,
						unique: true,
						read: true,
						write: true
					},
					this.options
				)
			);

			// new_email - updated email during verification process
			if (this.config.email_verification) {
				res.push(
					userEntity.addField(
						{
							name: "verified",
							type: "boolean",
							required: true,
							default: true,
							defaultValue: false,
							component: "input",
							read: true,
							write: true
						},
						this.options
					)
				);

				res.push(
					userEntity.addField(
						{
							name: "new_email",
							type: "text",
							required: false,
							read: true,
							write: true
						},
						this.options
					)
				);

				res.push(
					userEntity.addField(
						{
							name: "key_email",
							type: "text",
							required: false,
							component: "input",
							read: true,
							write: true
						},
						this.options
					)
				);
			}
			this.signupParams.push({
				name: "email",
				type: "text",
				required: true
			});
		}

		if (this.config.type == "username" || this.config.type == "both") {
			res.push(
				userEntity.addField(
					{
						name: "username",
						type: "text",
						required: true,
						unique: true,
						read: true,
						write: true
					},
					this.options
				)
			);
			this.signupParams.push({
				name: "username",
				type: "text",
				required: true
			});
		}
		res.push(
			userEntity.addField(
				{
					name: "password",
					type: "text",
					required: true,
					unique: false,
					component: "password",
					read: true,
					write: true
				},
				this.options
			)
		);
		this.signupParams.push({
			name: "password",
			type: "text",
			required: true,
			component: "password"
		});
		if (this.config.email_verification) {
			res.push(
				userEntity.addField(
					{
						name: "key_password",
						type: "text",
						required: false,
						component: "input",
						read: true,
						write: true
					},
					this.options
				)
			);
		}

		if (this.config.fields.length) {
			this.config.fields.forEach(field => {
				res.push(
					userEntity.addField(
						{
							name: field.name,
							type: field.type,
							required: field.required || false,
							unique: field.unique || false,
							read: true,
							write: true
						},
						this.options
					)
				);

				if (field.signup) {
					this.signupParams.push({
						name: field.name,
						type: field.type,
						required: field.required
					});
				}
			});
		}
		return Promise.all(res).catch(() => Promise.resolve());
	}

	afterLoadQueries() {
		if (this.disabled) {
			return Promise.resolve();
		}
		const userEntity = this.app.entities.get("user");

		userEntity.addQuery(
			{
				id: "signup",
				type: "custom",
				opts: {
					params: this.signupParams,
					action: "signup"
				}
			},
			this.options
		);

		if (this.config.type == "email" || this.config.type == "both") {
			userEntity.addQuery(
				{
					id: "getByEmail",
					type: "findOne",
					opts: {
						conditions: [
							{
								name: "email",
								operator: "=",
								value: "="
							}
						]
					}
				},
				this.options
			);

			if (this.config.email_verification) {
				userEntity.addQuery(
					{
						id: "lostPassword",
						type: "custom",
						opts: {
							params: [
								{
									name: "login",
									type: "text",
									required: true
								}
							],
							action: "lostPassword"
						}
					},
					this.options
				);

				userEntity.addQuery(
					{
						id: "verifyEmail",
						type: "custom",
						opts: {
							params: [
								{
									name: "id_user",
									type: "text",
									required: true
								},
								{
									name: "key_email",
									type: "text",
									required: true
								}
							],
							action: "verifyEmail"
						}
					},
					this.options
				);

				userEntity.addQuery(
					{
						id: "sendVerificationEmail",
						type: "custom",
						opts: {
							params: [
								{
									name: "id_user",
									type: "number",
									required: true
								}
							],
							action: "sendVerificationEmail"
						}
					},
					this.options
				);
			}
		}
		if (this.config.type == "username" || this.config.type == "both") {
			userEntity.addQuery(
				{
					id: "getByUsername",
					type: "findOne",
					opts: {
						conditions: [
							{
								name: "username",
								operator: "=",
								value: "="
							}
						]
					}
				},
				this.options
			);
		}
		return Promise.resolve();
	}

	afterLoadAPI() {
		if (this.disabled) {
			return Promise.resolve();
		}

		const res = [];

		const signupEndpoint = this.app.api.get("post", "/user/signup");
		const putMeEndpoint = this.app.api.get("put", "/user/me");
		const destroyEndpoint = this.app.api.get("delete", "/user/me");

		const idParam = {
			name: "id_user",
			type: "number",
			required: true
		};

		this.signupParams.forEach(param => {
			signupEndpoint.params.push({
				name: param.name,
				type: param.type,
				required: param.required,
				component: param.component
			});

			if (
				param.name != "email" &&
				param.name != "password" &&
				param.name != "username"
			) {
				putMeEndpoint.params.push({
					name: param.name,
					type: param.type,
					required: false,
					component: param.component
				});
			}
		});

		if (this.config.type == "email" || this.config.type == "both") {
			this.app.api.add(
				{
					method: "put",
					url: "/user/me/email",
					params: [
						{
							name: "new_email",
							type: "text",
							required: true,
							component: "email"
						}
					],
					controller: "default",
					action: "changeEmail",
					permissions: ["Authenticated"],
					parent: "User management",
					fromAddon: this.app.addons.get("@materia/users")
				},
				this.options
			);

			if (this.config.email_verification) {
				this.app.api.add(
					{
						method: "get",
						url: "/user/verify/:id_user/:key_email",
						params: [
							{
								name: "id_user",
								type: "number",
								required: true
							},
							{
								name: "key_email",
								type: "text",
								required: true
							}
						],
						parent: "User management",
						controller: "default",
						action: "verifyEmail",
						fromAddon: this.app.addons.get("@materia/users")
					},
					this.options
				);

				this.app.api.add(
					{
						method: "post",
						url: "/user/lost_password",
						params: [
							{
								name: "login",
								type: "text",
								required: true
							}
						],
						query: {
							entity: "user",
							id: "lostPassword"
						},
						parent: "User management",
						fromAddon: this.app.addons.get("@materia/users")
					},
					this.options
				);

				this.app.api.add(
					{
						method: "put",
						url: "/user/lost_password",
						params: [
							{
								name: "new_password",
								type: "text",
								required: true
							},
							{
								name: "key",
								type: "text",
								required: true
							},
							{
								name: "id_user",
								type: "number",
								required: true
							}
						],
						parent: "User management",
						controller: "default",
						action: "changeLostPassword",
						fromAddon: this.app.addons.get("@materia/users")
					},
					this.options
				);
			}
		}
		if (this.config.type == "username" || this.config.type == "both") {
			this.app.api.add(
				{
					method: "put",
					url: "/user/me/username",
					params: [
						{
							name: "new_username",
							type: "text",
							required: true
						}
					],
					controller: "default",
					action: "changeUsername",
					permissions: ["Authenticated"],
					parent: "User management",
					fromAddon: this.app.addons.get("@materia/users")
				},
				this.options
			);
		}
		return Promise.all(res).then(() => true);
	}

	start() {
		if (this.disabled) {
			return Promise.resolve();
		}

		passport.use(
			new LocalStrategy(
				{
					usernameField: "login",
					passwordField: "password"
				},
				(login, password, done) => {
					let promise = Promise.resolve();
					if (
						this.config.type == "email" ||
						this.config.type == "both"
					) {
						promise = promise.then(() => {
							return this.app.entities
								.get("user")
								.getQuery("getByEmail")
								.run({ email: login }, { raw: true });
						});
					}
					if (
						this.config.type == "username" ||
						this.config.type == "both"
					) {
						promise = promise.then(user => {
							if (user) {
								return Promise.resolve(user);
							}
							return this.app.entities
								.get("user")
								.getQuery("getByUsername")
								.run({ username: login }, { raw: true });
						});
					}
					return promise
						.then((user: any) => {
							const encPassword = md5(
								this.config.static_salt + password + user.salt
							);
							if (user.password == encPassword) {
								delete user.password;
								delete user.salt;
								delete user.key_email;
								delete user.key_password;
								return done(null, user);
							} else {
								return done(null, false);
							}
						})
						.catch(e => {
							return done(null, false);
						});
				}
			)
		);

		passport.serializeUser(function(user, done) {
			done(null, user.id_user);
		});

		passport.deserializeUser((id_user, done) => {
			this.app.entities
				.get("user")
				.getQuery("get")
				.run({ id_user: id_user }, { raw: true })
				.then(user => {
					delete user.password;
					delete user.salt;
					delete user.key_password;
					delete user.key_email;
					done(null, user);
				})
				.catch(err => {
					done(err);
				});
		});

		this.app.api.permissions.add({
			name: "Authenticated",
			description: "Only signed in users are allowed",
			middleware: (req, res, next) => {
				if (req.user) {
					return next();
				}
				const e: any = new Error("Unauthorized");
				e.statusCode = 401;
				throw e;
			},
			readOnly: true,
			exports: {
				// Not used yet but could be used for injecting param in endpointn builder.
				"me.id_user": "user.id_user", // req.user.id_user
				"me.email": "user.email", // req.user.email etc.
				"me.name": "user.name"
				// TODO: add other user fields here
			}
		});

		this.app.api.permissions.add({
			name: "Connected User ID",
			description: "Inject the id of the connected user",
			middleware: (req, res, next) => {
				if (req.user) {
					if (req.method == "get" || req.method == "delete") {
						req.query.id_user = req.user.id_user;
					} else {
						req.body.id_user = req.user.id_user;
					}
					return next();
				} else {
					const e: any = new Error("Unauthorized");
					e.statusCode = 401;
					throw e;
				}
			},
			readOnly: true
		});

		this.app.entities
			.get("user_role")
			.getQuery("list")
			.run({}, { raw: true, silent: true })
			.then(roles => {
				roles.data.forEach(row => {
					const nameCapitalized =
						row.role.substr(0, 1).toUpperCase() +
						row.role.substr(1).toLowerCase();
					this.app.api.permissions.add({
						name: nameCapitalized,
						description:
							'Only users associated with the role "' +
							row.role +
							'" are allowed.',
						readOnly: true,
						middleware: (req, res, next) => {
							if (req.user) {
								this.app.entities
									.get("user_permission")
									.getQuery("getUserRoles")
									.run({
										id_user: req.user.id_user
									})
									.then(result => {
										const roles2 = result.data;
										if (
											roles2.find(r => r.role == row.role)
										) {
											next();
										} else {
											const e: any = new Error(
												"Unauthorized"
											);
											e.statusCode = 401;
											throw e;
										}
									});
							} else {
								const e: any = new Error("Unauthorized");
								e.statusCode = 401;
								throw e;
							}
						}
					});
				});
			})
			.catch(e => {
				console.log(e);
			});
	}

	uninstall(app) {}
}