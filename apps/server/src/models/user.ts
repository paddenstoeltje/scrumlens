import mongoose from 'mongoose'
import { generateSalt, hashPassword } from '@/utils'

const { Schema } = mongoose

export const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    salt: String,
    isActive: {
      type: Boolean,
      default: false,
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
    teamId: {
      type: String,
      enum: ['admin', 'team1', 'team2', 'team3', 'team4', 'team5', 'team6', 'team7', 'team8', 'team9', 'team10', 'team11', 'team12', 'team13', 'team14', 'team15', 'team16', 'team17', 'team18', 'team19', 'team20', 'team21', 'team22', 'team23', 'team24'],
      default: null,
    },
    role: {
      type: String,
      enum: ['admin', 'viewer', 'editor'],
      default: 'editor',
    },
  },
  {
    timestamps: true,
  },
)

userSchema.pre('save', function (next) {
  if (!this.isModified('password')) {
    return next()
  }

  this.salt = generateSalt()
  this.password = hashPassword(this.password, this.salt)
  next()
})

export const User = mongoose.model('User', userSchema)
